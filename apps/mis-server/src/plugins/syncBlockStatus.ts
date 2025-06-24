import { plugin } from "@ddadaal/tsgrpc-server";
import { SyncBlockStatusResponse } from "@scow/protos/build/server/admin";
import cron from "node-cron";
import { commonConfig } from "src/config/common";
import { misConfig } from "src/config/mis";
import { lastSyncTime, synchronizeAccountUser } from "src/tasks/syncAccountUser";
import { synchronizeBlockStatus } from "src/tasks/syncBlockStatus";

export interface SyncBlockStatusPlugin {
  // Deprecated 
  // 同步封锁状态功能已升级为同步账户用户数据功能
  // 只使用 syncAccountUser
  syncBlockStatus: {
    started: () => boolean;
    start: () => void;
    stop: () => void;
    schedule: string;
    lastSyncTime: () => Date | null;
    run: () => Promise<SyncBlockStatusResponse | undefined>;
  };
  syncAccountUser: {
    started: () => boolean;
    start: () => void;
    stop: () => void;
    schedule: string;
    lastSyncTime: () => Date | null;
    run: (maxSyncDurationMinutes?: number, operatorId?: string) => Promise<string | undefined>;
  };
}

/**
 * 除封锁状态以外，同步账户及账户下用户关联数据
 */
export const syncBlockStatusPlugin = plugin(async (f) => {
  const synchronizeCron = misConfig.periodicSyncUserAccountBlockStatus?.cron ?? "0 4 * * *";
  // 如果配置了资源管理系统服务，则资源管理系统配置项 syncBlockStatusWhenStart 也为 true 时才在启动时满足 synchronizeEnabled
  let synchronizeEnabled = !!misConfig.periodicSyncUserAccountBlockStatus?.enabled
   && !(commonConfig.scowResource?.syncBlockStatusWhenStart === false);
  let synchronizeIsRunning = false;

  const logger = f.logger.child({ plugin: "syncAccountUser" });
  logger.info("misConfig.periodicSyncStatus?.cron: %s", misConfig.periodicSyncUserAccountBlockStatus?.cron);

  const maxSyncDurationMinConfigValue = misConfig.syncAccountUser.maxSyncDurationMinutes;

  /**
   * Deprecated
   * 同步封锁状态功能已升级为同步账户用户数据功能
   * 使用 syncAccountUserTrigger
   * @returns 
   */
  const trigger = async () => {

    const sublogger = logger.child({ time: new Date() });

    if (synchronizeIsRunning) {
      sublogger.info("Sync is already running.");
      return Promise.resolve(undefined);
    }

    synchronizeIsRunning = true;
    sublogger.info("Sync starts to run.");

    try {
      return await synchronizeBlockStatus(f.ext.orm.em.fork(), sublogger, f.ext, f.ext);
    } finally {
      synchronizeIsRunning = false;
    }
  };
  
  const syncAccountUserTrigger = async (maxSyncDurationMinutes?: number, operatorId?: string) => {

    const sublogger = logger.child({ time: new Date() });

    if (synchronizeIsRunning) {
      sublogger.info("Account user synchronization is already running.");
      return Promise.resolve(undefined);
    }

    // 确保没有在同步作业过程中执行同步任务，防止同步时间过长导致作业扣费超时
    const isFetchJobRunning = f.ext.fetch.isRunning;
    if (isFetchJobRunning) {
      sublogger.info("Can not start a synchronization task during fetching jobs.");
      return Promise.resolve(undefined);
    }

    synchronizeIsRunning = true;
    sublogger.info("Account user synchronization starts to run.");

    try {
      return await synchronizeAccountUser(f.ext.orm.em.fork(),
        sublogger, f.ext, f.ext, operatorId, maxSyncDurationMinutes, f.ext);
    } finally {
      synchronizeIsRunning = false;
    }
  };

  const task = cron.schedule(
    synchronizeCron,
    () => { void syncAccountUserTrigger(maxSyncDurationMinConfigValue); },
    {
      timezone: "Asia/Shanghai",
      scheduled: synchronizeEnabled,
    },
  );

  logger.info("Account user synchronization started.");

  f.addCloseHook(() => {
    task.stop();
    logger.info("Account user synchronization stopped.");
  });

  // Deprecated
  // 同步封锁状态功能已升级为同步账户用户数据功能
  f.addExtension("syncBlockStatus", ({
    started: () => synchronizeEnabled,
    start: () => {
      logger.info("Sync is started");
      synchronizeEnabled = true;
      task.start();
    },
    stop: () => {
      logger.info("Sync is started");
      synchronizeEnabled = false;
      task.stop();
    },
    schedule: synchronizeCron,
    lastSyncTime: () => lastSyncTime,
    run: trigger,
  } satisfies SyncBlockStatusPlugin["syncBlockStatus"]));

  f.addExtension("syncAccountUser", ({
    started: () => synchronizeEnabled,
    start: () => {
      logger.info("Account user synchronization is started");
      synchronizeEnabled = true;
      task.start();
    },
    stop: () => {
      logger.info("Account user synchronization is stopped");
      synchronizeEnabled = false;
      task.stop();
    },
    schedule: synchronizeCron,
    lastSyncTime: () => lastSyncTime,
    run: (maxSyncDurationMinutes, operatorId) => syncAccountUserTrigger(maxSyncDurationMinutes, operatorId),
  } satisfies SyncBlockStatusPlugin["syncAccountUser"]));

  if (synchronizeEnabled) {
    logger.info("Started a new Account user synchronization");
    void syncAccountUserTrigger(maxSyncDurationMinConfigValue);
  } else {
    logger.info("Account user synchronization is disabled.");
  }
});
