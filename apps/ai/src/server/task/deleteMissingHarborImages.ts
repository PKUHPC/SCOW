import cron from "node-cron";

import { aiConfig } from "../config/ai";
import { Image, Status } from "../entities/Image";
import { forkEntityManager } from "../utils/getOrm";
import { getHarborConfig, HarborClient } from "../utils/harbor";
import { logger } from "../utils/logger";


// path例如：10.129.227.64/u_lyl_test/vscode-mnist:latest
async function checkHarborImageExists(
  path: string,
  harbor: HarborClient,
): Promise<boolean> {
  try {
    // 1. 去掉 registry 部分
    //    比如 ["10.129.227.64", "u_lyl_test", "vscode-mnist:latest"]
    const parts = path.split("/");
    if (parts.length < 2) {
      logger.debug?.(`[HarborExists] invalid path (missing project/repo): ${path}`);
      return false;
    }

    // registry = parts[0]，丢掉
    const withoutRegistry = parts.slice(1); // ["u_lyl_test", "vscode-mnist:latest"]

    // 2. 拆分 project 和 repo:tag
    const project = withoutRegistry[0]; // "u_lyl_test"
    const repoWithTag = withoutRegistry.slice(1).join("/"); // 支持多级 repo

    const colonIdx = repoWithTag.lastIndexOf(":");
    if (colonIdx <= 0) {
      logger.debug(`[HarborExists] invalid repo:tag in path: ${path}`);
      return false;
    }

    const repo = repoWithTag.slice(0, colonIdx); // "vscode-mnist"
    const tag = repoWithTag.slice(colonIdx + 1); // "latest"

    if (!project || !repo || !tag) {
      logger.debug(`[HarborExists] parsed invalid components: ${path}`);
      return false;
    }

    const fullRepoName = `${project}/${repo}`;

    // 3. 查询 Harbor artifacts
    const artifacts = await harbor.getArtifacts(fullRepoName, project);
    if (!artifacts || artifacts.length === 0) {
      return false;
    }

    // 4. 检查是否包含指定 tag
    return artifacts.some(
      (a: any) =>
        Array.isArray(a?.tags) && a.tags.some((t: any) => t?.name === tag),
    );
  } catch (err: any) {
    const msg = String(err?.message ?? err ?? "");
    if (msg.includes("404")) {
      return false;
    }

    // 其他异常：网络/权限/500 等，都视为未知，保守处理为存在
    logger.debug(`[HarborExists] check failed for ${path}: ${msg}`);
    return true;
  }
}

const harborConfig = getHarborConfig();
const harbor = new HarborClient(harborConfig);

let cleanupIsRunning = false;

/**
 * 定期任务的核心逻辑：
 * - 开始/结束打点
 * - 校验不存在则记录 info，并以【短事务】删除
 * - 删除失败才记 error；成功不打日志
 * - 批量分页避免一次性拉爆内存
 */
export async function deleteMissingHarborImages() {
  if (!aiConfig.imageCleanup?.enabled) return;

  logger.info("image cleanup started");

  const em = await forkEntityManager();

  // 普通读取，不在大事务里；分页控制内存占用
  const batchSize = 500;
  let lastId = 0;
  let checked = 0;
  let deleted = 0;

  while (true) {
    const images = await em.find(
      Image,
      { id: { $gt: lastId }, status: Status.CREATED },
      { limit: batchSize, orderBy: { id: "asc" } },
    );

    if (images.length === 0) break;

    for (const img of images) {
      lastId = img.id;
      checked += 1;

      // path 字段是 harbor 中的镜像地址
      const path = img.path;
      if (!path) continue;

      let exists = true;
      try {
        exists = await checkHarborImageExists(path,harbor);
      } catch (err) {
        logger.debug(`harbor check failed for ${path}: ${String(err)}`);
        continue;
      }

      if (exists) continue;

      logger.info(`image ${path} no longer exists in harbor. Removing it from scow`);

      // 每条删除操作用独立短事务，避免长事务占锁
      try {
        await em.transactional(async (tx) => {
          // 幂等/并发安全：用主键条件删除；如果已被别的实例删掉，影响 0 行即可
          // 这里用 nativeDelete 避免加载实体，效率更高
          await tx.nativeDelete(Image, { id: img.id });
        });
        deleted += 1;
      } catch (err) {
        logger.error(`failed to delete image ${String(img.id)} (${path}). reason=${String(err)}`);
      }
    }
  }

  logger.info(`cleanup stats: checked=${checked}, deleted=${deleted}`);
  logger.info("image cleanup completed");
}

/**
 * 触发器：防止重入
 */
const trigger = async () => {
  if (cleanupIsRunning) return;
  cleanupIsRunning = true;
  try {
    await deleteMissingHarborImages();
  } finally {
    cleanupIsRunning = false;
  }
};

/**
 * 定时任务注册
 * - 周期配置使用 aiConfig.imageCleanup.cron（例如："0 * * * *"）
 */
const task = cron.schedule(
  aiConfig.imageCleanup?.cron ?? "0 * * * *",
  () => {
    trigger().catch((error) => {
      logger.error("Error running image cleanup:", error);
    });
  },
  {
    timezone: "Asia/Shanghai",
    scheduled: true,
  },
);

export const startDeleteMissingHarborImages = () => {
  task.start();
  logger.info("The timer for deleting missing harbor images has started");
};

export const stopDeleteMissingHarborImages = () => {
  task.stop();
  logger.info("The timer for deleting missing harbor images has stopped");
};
