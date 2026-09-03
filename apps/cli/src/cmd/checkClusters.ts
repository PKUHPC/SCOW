import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ClusterConfigSchema, getClusterConfigs, getLoginNode } from "@scow/config/build/cluster";
import { createAdapterCertificates } from "@scow/lib-scheduler-adapter";
import { getSchedulerAdapterClient } from "@scow/lib-scheduler-adapter/build/client";
import { SslConfig as AdapterSslConfig } from "@scow/lib-scheduler-adapter/build/ssl";
import { getScowdClient } from "@scow/lib-scowd/build/client";
import { createScowdCertificates, SslConfig as ScowdSslConfig } from "@scow/lib-scowd/build/ssl";
import { removePort } from "@scow/utils";
import { existsSync } from "fs";
import { join } from "path";
import { getInstallConfig, InstallConfigSchema } from "src/config/install";
import { logger } from "src/log";

interface Options {
  configPath: string;
  scowConfigPath: string;
  continueOnError: boolean;
}

interface LoginNodeCheckResult {
  name: string;
  address: string;
  url: string;
  success: boolean;
  error?: string;
}

interface ClusterCheckResult {
  clusterId: string;
  adapterCheck: {
    url: string;
    success: boolean;
    version?: { major: number; minor: number; patch: number };
    error?: string;
  };
  scowdCheck?: {
    loginNodes: LoginNodeCheckResult[];
  };
  hasError: boolean;
}

function generateScowdUrl(address: string, scowdPort: number, sslEnabled: boolean) {
  return sslEnabled ? `https://${removePort(address)}:${scowdPort}` : `http://${removePort(address)}:${scowdPort}`;
}

export const checkClusters = async ({ configPath, scowConfigPath, continueOnError }: Options) => {
  logger.info("Starting cluster connectivity check...");

  let hasError = false;

  // 读取安装配置
  let installConfig: InstallConfigSchema;
  try {
    installConfig = getInstallConfig(configPath);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error("Failed to read install config from %s: %s", configPath, error);
    process.exit(1);
  }

  // 读取集群配置
  let clusters: Record<string, ClusterConfigSchema>;
  try {
    clusters = getClusterConfigs(scowConfigPath, logger);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error("Failed to read cluster configs from %s: %s", scowConfigPath, error);
    if (!continueOnError) {
      process.exit(1);
    }
    hasError = true;
    clusters = {};
  }

  const clusterCount = Object.keys(clusters).length;
  logger.info("Found %d cluster(s) to check", clusterCount);

  if (clusterCount === 0) {
    logger.warn("No clusters found in configuration");
    process.exit(hasError ? 1 : 0);
  }

  // 准备 SSL 证书配置
  const scowdSslEnabled = installConfig.scowd?.ssl?.enabled ?? false;
  const adapterSslEnabled = installConfig.adapter?.ssl?.enabled ?? false;

  logger.info("SCOWD SSL: %s", scowdSslEnabled ? "Enabled" : "Disabled");
  logger.info("Adapter SSL: %s", adapterSslEnabled ? "Enabled" : "Disabled");

  let scowdCertificates: ScowdSslConfig = {};
  let adapterCertificates: AdapterSslConfig = { enabled: false };

  // 配置 scowd SSL
  if (scowdSslEnabled && installConfig.scowd?.ssl) {
    const { caCertPath, scowCertPath, scowPrivateKeyPath } = installConfig.scowd.ssl;

    const fullCaCertPath = join(scowConfigPath, caCertPath);
    const fullScowCertPath = join(scowConfigPath, scowCertPath);
    const fullScowPrivateKeyPath = join(scowConfigPath, scowPrivateKeyPath);

    if (!existsSync(fullCaCertPath)) {
      logger.error("SCOWD CA certificate not found at %s", fullCaCertPath);
      hasError = true;
    } else if (!existsSync(fullScowCertPath)) {
      logger.error("SCOWD SCOW certificate not found at %s", fullScowCertPath);
      hasError = true;
    } else if (!existsSync(fullScowPrivateKeyPath)) {
      logger.error("SCOWD SCOW private key not found at %s", fullScowPrivateKeyPath);
      hasError = true;
    } else {
      try {
        scowdCertificates = createScowdCertificates({
          SCOWD_SSL_ENABLED: true,
          SCOWD_SSL_CA_CERT_PATH: fullCaCertPath,
          SCOWD_SSL_SCOW_CERT_PATH: fullScowCertPath,
          SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: fullScowPrivateKeyPath,
        });
        logger.debug("SCOWD SSL certificates loaded successfully");
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logger.error("Failed to load SCOWD SSL certificates: %s", error);
        hasError = true;
      }
    }
  }

  // 配置 adapter SSL
  if (adapterSslEnabled && installConfig.adapter?.ssl) {
    const { caCertPath, scowCertPath, scowPrivateKeyPath } = installConfig.adapter.ssl;

    const fullCaCertPath = join(scowConfigPath, caCertPath);
    const fullScowCertPath = join(scowConfigPath, scowCertPath);
    const fullScowPrivateKeyPath = join(scowConfigPath, scowPrivateKeyPath);

    if (!existsSync(fullCaCertPath)) {
      logger.error("Adapter CA certificate not found at %s", fullCaCertPath);
      hasError = true;
    } else if (!existsSync(fullScowCertPath)) {
      logger.error("Adapter SCOW certificate not found at %s", fullScowCertPath);
      hasError = true;
    } else if (!existsSync(fullScowPrivateKeyPath)) {
      logger.error("Adapter SCOW private key not found at %s", fullScowPrivateKeyPath);
      hasError = true;
    } else {
      try {
        adapterCertificates = createAdapterCertificates({
          ADAPTER_SSL_ENABLED: true,
          ADAPTER_SSL_CA_CERT_PATH: fullCaCertPath,
          ADAPTER_SSL_SCOW_CERT_PATH: fullScowCertPath,
          ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: fullScowPrivateKeyPath,
        });
        logger.debug("Adapter SSL certificates loaded successfully");
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        logger.error("Failed to load adapter SSL certificates: %s", error);
        hasError = true;
      }
    }
  }

  // 检查每个集群
  logger.info("Checking all clusters...");

  const checkPromises = Object.entries(clusters).map(
    async ([clusterId, clusterConfig]: [string, ClusterConfigSchema]): Promise<ClusterCheckResult> => {
      const result: ClusterCheckResult = {
        clusterId,
        adapterCheck: {
          url: clusterConfig.adapterUrl,
          success: false,
        },
        hasError: false,
      };

      // 检查适配器连接
      try {
        const adapterClient = getSchedulerAdapterClient(clusterConfig.adapterUrl, adapterCertificates, {
          timeoutMs: (installConfig.adapter?.timeoutSeconds ?? 60) * 1000,
        });

        // 尝试获取版本信息来验证连接
        const version = await asyncClientCall(adapterClient.version, "getVersion", {});
        result.adapterCheck.success = true;
        result.adapterCheck.version = version;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        result.adapterCheck.success = false;
        result.adapterCheck.error = error;
        result.hasError = true;
      }

      const loginNodes = clusterConfig.loginNodes.map(getLoginNode);
      const loginNodeResults: LoginNodeCheckResult[] = [];

      for (const loginNode of loginNodes) {
        const { name, address, scowdPort } = loginNode;
        const scowdUrl = generateScowdUrl(address, scowdPort, scowdSslEnabled);

        try {
          const scowdClient = getScowdClient(scowdUrl, scowdCertificates);

          // 使用 checkHealth 接口检查 scowd 健康状态
          await scowdClient.system.checkHealth({}, { timeoutMs: 10000 });
          loginNodeResults.push({
            name: typeof name === "string" ? name : name.i18n.default,
            address,
            url: scowdUrl,
            success: true,
          });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          loginNodeResults.push({
            name: typeof name === "string" ? name : name.i18n.default,
            address,
            url: scowdUrl,
            success: false,
            error,
          });
          result.hasError = true;
        }
      }

      result.scowdCheck = { loginNodes: loginNodeResults };

      return result;
    },
  );

  const results = await Promise.all(checkPromises);
  const failedClusters = results.filter((result) => result.hasError).length;

  // 输出所有集群的检查结果
  logger.info("\n========================================");
  logger.info("Check Results by Cluster");
  logger.info("========================================");

  for (const result of results) {
    logger.info("\n========================================");
    logger.info("Cluster: %s", result.clusterId);
    logger.info("========================================");

    // 输出适配器检查结果
    logger.info("\nScheduler Adapter:");
    logger.info("  URL: %s (SSL: %s)", result.adapterCheck.url, adapterSslEnabled ? "Enabled" : "Disabled");
    if (result.adapterCheck.success) {
      logger.info("  Status: ✓ Connected");
      if (result.adapterCheck.version) {
        logger.info(
          "  Version: %d.%d.%d",
          result.adapterCheck.version.major,
          result.adapterCheck.version.minor,
          result.adapterCheck.version.patch,
        );
      }
    } else {
      logger.error("  Status: ✗ Failed");
      logger.error("  Error: %s", result.adapterCheck.error);
    }

    // 输出 scowd 检查结果
    if (result.scowdCheck) {
      logger.info("\nSCOWD (SSL: %s):", scowdSslEnabled ? "Enabled" : "Disabled");
      for (const node of result.scowdCheck.loginNodes) {
        logger.info("  Login node: %s (%s)", node.name, node.address);
        logger.info("    URL: %s", node.url);
        if (node.success) {
          logger.info("    Status: ✓ Connected");
        } else {
          logger.error("    Status: ✗ Failed");
          logger.error("    Error: %s", node.error);
        }
      }
    }
  }

  logger.info("\n========================================");
  logger.info("Environment check completed");
  logger.info("========================================");
  logger.info("Total clusters checked: %d", clusterCount);
  logger.info("Failed clusters: %d", failedClusters);
  logger.info("Successful clusters: %d", clusterCount - failedClusters);

  if (failedClusters > 0 || hasError) {
    logger.error("\n⚠ Environment check failed");
    if (!continueOnError) {
      process.exit(1);
    }
  } else {
    logger.info("\n✓ All checks passed successfully");
  }
};
