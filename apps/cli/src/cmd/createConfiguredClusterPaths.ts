import { getClusterConfigs, getLoginNode, LoginNode } from "@scow/config/build/cluster";
import { spawnSync } from "child_process";
import prompt from "prompts";
import { validateClusterAiConfig } from "src/config/validateClusterAiConfig";
import { logger } from "src/log";

interface Options {
  scowConfigPath: string;
}

interface ConfiguredClusterPath {
  clusterId: string;
  path: string;
  loginNodes: LoginNode[];
}

type PathCheckResult =
  | { kind: "exists" }
  | { kind: "missing" }
  | { kind: "notDir" }
  | { kind: "sshError"; error: string };

// 从集群配置中收集当前命令需要处理的路径（当前仅处理 ai.clusterPublicPath）。
// 先通过 validateClusterAiConfig 统一校验，再收集已启用 AI 的集群路径。
function collectConfiguredClusterPaths(scowConfigPath: string): ConfiguredClusterPath[] {
  const clusters = getClusterConfigs(scowConfigPath, logger);

  validateClusterAiConfig(clusters, scowConfigPath);

  return Object.entries(clusters).flatMap(([clusterId, cluster]) => {
    if (!cluster.ai?.enabled) {
      return [];
    }

    return [
      {
        clusterId,
        path: cluster.ai.clusterPublicPath!.trim(),
        loginNodes: cluster.loginNodes.map(getLoginNode),
      },
    ];
  });
}

// 将路径包成 shell 安全的单个参数，避免空格、单引号等特殊字符破坏远端命令。
function quoteForShell(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

// 复用当前机器的 SSH 环境。
// 开启 BatchMode=yes 后，未配置免密登录时会直接失败，不会卡在密码输入。
function runSsh(address: string, remoteCommand: string) {
  return spawnSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", address, remoteCommand], {
    encoding: "utf-8",
    stdio: "pipe",
  });
}

// 通过远端命令的退出码区分路径状态，避免依赖输出文本。
// 退出码约定：
// - 0: 目录存在
// - 10: 路径不存在
// - 11: 路径存在但不是目录
function checkRemotePath(address: string, path: string): PathCheckResult {
  const quotedPath = quoteForShell(path);
  const remoteCommand =
    `if [ -d ${quotedPath} ]; then exit 0; ` + `elif [ -e ${quotedPath} ]; then exit 11; ` + "else exit 10; fi";
  const result = runSsh(address, remoteCommand);

  if (result.error) {
    return { kind: "sshError", error: result.error.message };
  }

  if (result.status === 0) {
    return { kind: "exists" };
  }

  if (result.status === 11) {
    return { kind: "notDir" };
  }

  if (result.status === 10) {
    return { kind: "missing" };
  }

  const sshError = (result.stderr || result.stdout || "").trim();
  return {
    kind: "sshError",
    error: sshError
      ? `${sshError}. Ensure this machine can passwordless SSH as root to ${address}.`
      : `ssh command failed with exit code ${result.status}. Ensure this machine can passwordless SSH as root to ${address}.`,
  };
}

// 先检查远端是否具备 root 权限，再创建目录并设置 root:root 755。
// 预检可避免 mkdir -p 成功但 chown 失败导致的半成功状态。
function createRemoteDirectory(address: string, path: string) {
  const quotedPath = quoteForShell(path);
  const remoteCommand =
    "id -u | grep -qx 0 || { echo 'Remote user is not root'; exit 1; }; " +
    `mkdir -p ${quotedPath} && chown root:root ${quotedPath} && chmod 755 ${quotedPath}`;
  return runSsh(address, remoteCommand);
}

// 主流程：
// 1. 收集所有需要处理的集群路径
// 2. 对每个集群按登录节点顺序执行检查
// 3. 路径存在则通过；路径不存在则询问是否创建
// 4. 创建失败、用户跳过或所有登录节点都无法 SSH 时，最终返回非 0 退出码
export async function createConfiguredClusterPaths({ scowConfigPath }: Options) {
  const configuredPaths = collectConfiguredClusterPaths(scowConfigPath);

  // 没有匹配到任何待处理路径时，直接结束。
  if (configuredPaths.length === 0) {
    logger.info("No configured cluster paths found.");
    return;
  }

  // 记录是否出现任一失败或跳过，供最后统一决定退出码。
  let hasIssue = false;

  for (const item of configuredPaths) {
    logger.info("Checking configured path ai.clusterPublicPath=%s for cluster %s", item.path, item.clusterId);

    // 只要某个登录节点完成了有效检查（存在/不存在/非目录），即视为该集群已完成检查。
    // 如果所有登录节点都 SSH 失败，则保持 false，最后按集群失败处理。
    let checked = false;

    // 同一集群的登录节点应看到相同的挂载路径。
    // 因此只要任一登录节点检查或创建成功，即可视为该集群处理完成。
    for (const loginNode of item.loginNodes) {
      const checkResult = checkRemotePath(loginNode.address, item.path);

      // 当前登录节点无法通过 SSH 检查时，继续尝试该集群的下一个登录节点。
      if (checkResult.kind === "sshError") {
        logger.warn(
          "Failed to check path %s on cluster %s via login node %s: %s",
          item.path,
          item.clusterId,
          loginNode.address,
          checkResult.error,
        );
        continue;
      }

      checked = true;

      // 目录已存在：当前集群无需进一步处理。
      if (checkResult.kind === "exists") {
        logger.info("Configured path ai.clusterPublicPath=%s already exists for cluster %s", item.path, item.clusterId);
        break;
      }

      // 路径存在但不是目录：这是异常状态，当前集群直接记失败。
      if (checkResult.kind === "notDir") {
        logger.error(
          "Configured path ai.clusterPublicPath=%s exists for cluster %s, but it is not a directory",
          item.path,
          item.clusterId,
        );
        hasIssue = true;
        break;
      }

      // 路径不存在时，询问用户是否在该集群创建该目录。
      const answer = await prompt({
        type: "confirm",
        name: "shouldCreate",
        initial: true,
        message: `Configured path ai.clusterPublicPath='${item.path}' does not exist for cluster '${item.clusterId}'. Create it?`,
      });

      if (answer.shouldCreate === undefined) {
        logger.info("Operation cancelled by user.");
        process.exit(1);
      }

      // 用户拒绝创建：标记问题并继续处理下一个集群。
      if (!answer.shouldCreate) {
        logger.warn(
          "Skipped creating configured path ai.clusterPublicPath=%s for cluster %s",
          item.path,
          item.clusterId,
        );
        hasIssue = true;
        break;
      }

      // 用户确认后，通过当前登录节点执行远端 mkdir -p。
      const createResult = createRemoteDirectory(loginNode.address, item.path);

      // 创建失败：记录错误并结束当前集群处理。
      if (createResult.error || createResult.status !== 0) {
        const sshError = (createResult.stderr || createResult.stdout || "").trim();
        logger.error(
          "Failed to create configured path ai.clusterPublicPath=%s for cluster %s via login node %s: %s",
          item.path,
          item.clusterId,
          loginNode.address,
          createResult.error?.message ||
            (sshError
              ? `${sshError}. Ensure this machine can passwordless SSH as root to ${loginNode.address}.`
              : `ssh command failed with exit code ${createResult.status}. Ensure this machine can passwordless SSH as root to ${loginNode.address}.`),
        );
        hasIssue = true;
        break;
      }

      // 创建成功：当前集群处理完成。
      logger.info("Created configured path ai.clusterPublicPath=%s for cluster %s", item.path, item.clusterId);
      break;
    }

    if (!checked) {
      if (item.loginNodes.length === 0) {
        logger.error("No login nodes configured for cluster %s, cannot check path %s", item.clusterId, item.path);
      } else {
        logger.error(
          "Failed to check path %s on cluster %s: all login nodes are unavailable",
          item.path,
          item.clusterId,
        );
      }
      hasIssue = true;
    }
  }

  if (hasIssue) {
    // 保持非 0 退出码，便于自动化脚本识别存在跳过或失败的集群。
    process.exit(1);
  }
}
