import { Logger, plugin } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import { QueryCache } from "src/entities/QueryCache";
import { queryBillTypesCache } from "src/utils/bill";

export interface ClearCachePlugin {
  cache: {
    start: () => void;
    stop: () => void;
    schedule: string;
    lastCleared: () => Date | null;
    clear: () => Promise<void>;
  };
}

async function clearQueryCache(em: SqlEntityManager<MySqlDriver>, logger: Logger) {
  logger.info("Clearing query cache...");
  const result = await em
    .createQueryBuilder(QueryCache)
    .delete()
    .where({ timestamp: { $lt: new Date() } })
    .execute();
  logger.info(`Query cache cleared. Rows deleted: ${result.affectedRows}.`);
  return;
}

export const clearCachePlugin = plugin(async (f) => {
  let cacheClearStarted = false;
  let cacheClearIsRunning = false;

  // 每天零点清空缓存
  const schedule = "0 0 * * *";

  const logger = f.logger.child({ plugin: "cache" });

  const trigger = async () => {
    if (cacheClearIsRunning) return;

    cacheClearIsRunning = true;
    return await clearQueryCache(f.ext.orm.em.fork(), logger).finally(() => {
      cacheClearIsRunning = false;
      // 对于账单类型的查询缓存，清除后需重新生成
      void (misConfig.bill?.enabled && queryBillTypesCache(f.ext.orm.em.fork()));
    });
  };

  const task = cron.schedule(
    schedule,
    () => {
      void trigger();
    },
    {
      timezone: "Asia/Shanghai",
      scheduled: true,
    },
  );

  logger.info("Cache clear scheduled task started.");

  f.addCloseHook(() => {
    task.stop();
    logger.info("Cache clear scheduled task stopped.");
  });

  f.addExtension("cache", {
    start: () => {
      if (cacheClearStarted) {
        logger.info("Cache clear task is requested to start but already started");
      } else {
        task.start();
        cacheClearStarted = true;
        logger.info("Cache clear task started");
      }
    },
    stop: () => {
      if (!cacheClearStarted) {
        logger.info("Cache clear task is requested to stop but already stopped");
      } else {
        task.stop();
        cacheClearStarted = false;
        logger.info("Cache clear task stopped");
      }
    },
    schedule,
    clear: trigger,
  } as ClearCachePlugin["cache"]);
});
