import { plugin } from "@ddadaal/tsgrpc-server";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import {
  generateAccountSyncKey,
  lastAccountSyncTime,
  syncAccountStorageUsage,
} from "src/tasks/syncAccountStorageUsage";
import { SyncAccountStorageUsageError } from "src/utils/syncAccountsStorageUsage";

export interface SyncAccountStorageDataPlugin {
  syncAccountStorageUsage: {
    started: () => boolean;
    start: () => void;
    stop: () => void;
    schedule: string;
    lastSync: (storageId?: string, tenant?: string) => Date | null;
    run: (storageId?: string, tenant?: string) => Promise<SyncAccountStorageUsageError[]>;
    isRunning: boolean;
  };
}

export const SyncAccountStorageDataPlugin = plugin(async (f) => {
  // 默认每小时整点执行一次，与用户存储同步共用配置。
  const schedule = misConfig.periodicSyncStorageData?.cron ?? "0 * * * *";
  let syncAccountStorageDataStarted = !!misConfig.periodicSyncStorageData?.enabled;
  let syncAccountStorageDataIsRunning = false;

  const logger = f.logger.child({ plugin: "syncAccountStorageData" });

  const trigger = (storageId?: string, tenant?: string) => {
    if (syncAccountStorageDataIsRunning) return Promise.resolve([] as SyncAccountStorageUsageError[]);

    syncAccountStorageDataIsRunning = true;
    return syncAccountStorageUsage(f.ext.orm.em.fork(), logger, storageId, tenant).finally(() => {
      syncAccountStorageDataIsRunning = false;
    });
  };

  const task = cron.schedule(
    schedule,
    () => {
      void trigger()?.catch((e) => {
        logger.error("Error when syncing accounts storage usage. %o", e);
      });
    },
    {
      timezone: "Asia/Shanghai",
      scheduled: misConfig.periodicSyncStorageData?.enabled ?? false,
    },
  );

  logger.info("Account storage usage sync started.");

  f.addCloseHook(() => {
    task.stop();
    logger.info("Account storage usage sync stopped.");
  });

  f.addExtension("syncAccountStorageUsage", {
    started: () => syncAccountStorageDataStarted,
    start: () => {
      if (syncAccountStorageDataStarted) {
        logger.info("Account storage usage sync is requested to start but already started");
      } else {
        task.start();
        syncAccountStorageDataStarted = true;
        logger.info("Account storage usage sync started");
      }
    },
    stop: () => {
      if (!syncAccountStorageDataStarted) {
        logger.info("Account storage usage sync is requested to stop but already stopped");
      } else {
        task.stop();
        syncAccountStorageDataStarted = false;
        logger.info("Account storage usage sync stopped");
      }
    },
    schedule,
    lastSync: (storageId?: string, tenant?: string) => {
      if (storageId && tenant) {
        return lastAccountSyncTime[generateAccountSyncKey(storageId, tenant)];
      }
      let lastTime: Date | null = null;
      Object.keys(lastAccountSyncTime).forEach((key) => {
        if (lastAccountSyncTime[key] && (!lastTime || lastAccountSyncTime[key] > lastTime)) {
          lastTime = lastAccountSyncTime[key];
        }
      });
      return lastTime;
    },
    run: (storageId?: string, tenant?: string) => trigger(storageId, tenant),
    get isRunning() {
      return syncAccountStorageDataIsRunning;
    },
  } as SyncAccountStorageDataPlugin["syncAccountStorageUsage"]);
});
