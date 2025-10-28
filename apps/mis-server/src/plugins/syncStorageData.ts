import { plugin } from "@ddadaal/tsgrpc-server";
import cron from "node-cron";
import { misConfig } from "src/config/mis";
import { generateKey, lastSyncTime, syncStorageUsage } from "src/tasks/syncStorageUsage";
import { SyncError } from "src/utils/syncUsersStorageUsage";

export interface SyncStorageDataPlugin {
  syncStorageUsage: {
    started: () => boolean;
    start: () => void;
    stop: () => void;
    schedule: string;
    lastSync: (cluster?: string, path?: string, tenant?: string) => Date | null;
    run: (cluster?: string, path?: string, tenant?: string) => Promise<SyncError[]>;
    isRunning: boolean;
  }
}

export const SyncStorageDataPlugin = plugin(async (f) => {
  // 默认每小时整点执行一次
  const schedule = misConfig.periodicSyncStorageData?.cron ?? "0 * * * *";
  let syncStorageDataStarted = !!misConfig.periodicSyncStorageData?.enabled;
  let syncStorageDataIsRunning = false;

  const logger = f.logger.child({ plugin: "syncStorageData" });

  const trigger = (cluster?: string, path?: string, tenant?: string) => {
    if (syncStorageDataIsRunning) return Promise.resolve([] as SyncError[]);

    syncStorageDataIsRunning = true;
    return syncStorageUsage(f.ext.orm.em.fork(), logger, cluster, path, tenant).
      finally(() => { syncStorageDataIsRunning = false; });
  };

  const task = cron.schedule(
    schedule,
    () => { void trigger()?.catch((e) => {
      logger.error("Error when fetching jobs. %o", e);
    }); },
    {
      timezone: "Asia/Shanghai",
      scheduled: misConfig.periodicSyncStorageData?.enabled ?? false,
    },
  );

  logger.info("Fetch info started.");

  f.addCloseHook(() => {
    task.stop();
    logger.info("Fetch info stopped.");
  });

  f.addExtension("syncStorageUsage", ({
    started: () => syncStorageDataStarted,
    start: () => {
      if (syncStorageDataStarted) {
        logger.info("Fetch is requested to start but already started");
      } else {
        task.start();
        syncStorageDataStarted = true;
        logger.info("Fetch started");
      }
    },
    stop: () => {
      if (!syncStorageDataStarted) {
        logger.info("Fetch is requested to stop but already stopped");
      } else {
        task.stop();
        syncStorageDataStarted = false;
        logger.info("Fetch stopped");
      }
    },
    schedule,
    lastSync: (cluster?: string, path?: string, tenant?: string) => {
      if (cluster && path && tenant) {
        return lastSyncTime[generateKey(cluster, path, tenant)];
      }
      let lastTime: Date | null = null;
      Object.keys(lastSyncTime).forEach((key) => {
        if (lastSyncTime[key] && (!lastTime || lastSyncTime[key] > lastTime)) {
          lastTime = lastSyncTime[key];
        }
      });
      return lastTime;
    },
    run: (cluster?: string, path?: string, tenant?: string) => trigger(cluster, path, tenant),
    isRunning: syncStorageDataIsRunning,
  } as SyncStorageDataPlugin["syncStorageUsage"]));
});
