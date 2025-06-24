import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult as ClusterTotalSyncResultProto,
  ListAccountUserSynchronizationsResponse_SyncExceptionType as SyncExceptionTypeProto,
  ListAccountUserSynchronizationsResponse_SyncResult as SyncResultProto,
  ListAccountUserSynchronizationsResponse_SyncStatus as SyncStatusProto } from "@scow/protos/build/server/admin";
import { randomUUID } from "crypto";
import { Logger } from "pino";
import { commonConfig } from "src/config/common";
import { misConfig } from "src/config/mis";
import { AccountUserSyncRecord, SyncResult, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { ClusterPlugin } from "src/plugins/clusters";
import { FetchPlugin } from "src/plugins/fetch";
import { processSynchronization } from "src/utils/synchronizationUtils";

import { getActivatedClusters } from "./clustersUtils";

/**
 * Start a synchronization of account and users from scow to clusters
 *
 * @returns  sync session id during one synchronization task
 **/
export async function startAccountUserSynchronization(
  em: SqlEntityManager<MySqlDriver>, clusterPlugin: ClusterPlugin["clusters"], logger: Logger,
  scowResourcePlugin?: ScowResourcePlugin["resource"],
  operatorId?: string,
  maxSyncDurationMinutes?: number,
  fetchPlugin?: FetchPlugin["fetch"],
) {
  // 获取在线集群，确保当前存在在线集群
  const currentActivatedClusters = await getActivatedClusters(em, logger).catch((e) => {
    logger.info(e);
    return {};
  });

  if (Object.keys(currentActivatedClusters).length === 0) {
    logger.warn("No available activated clusters in SCOW.");
    return;
  }

  // 确保当前没有正在执行的同步任务
  const isSyncRunningFound = await em.findOne(AccountUserSyncRecord, {
    syncStatus: SyncStatus.RUNNING,
  });
  if (isSyncRunningFound) {
    logger.warn("Account user synchronization task is already running.");
    return;
  }

  // 确保没有在同步作业过程中执行同步任务，防止同步时间过长导致作业扣费超时
  const isFetchJobRunning = fetchPlugin?.isRunning;
  if (isFetchJobRunning) {
    logger.warn("Can not start a synchronization task during fetching jobs.");
    return;
  }

  // 确保 如果启用了资源管理服务，没有在资源服务未注入时开启同步任务
  if (commonConfig.scowResource?.enabled && !scowResourcePlugin) {
    logger.warn("Can not start a synchronization task when scow resource service is not ready.");
    return;
  }

  // 定义当前同步任务的sessionId，持久化
  const sessionId = randomUUID();
  const newAccountUserSync = new AccountUserSyncRecord({
    syncOperatorId: operatorId,
    sessionId,
    syncStatus: SyncStatus.RUNNING,
    maxSyncDurationMinutes: maxSyncDurationMinutes ? maxSyncDurationMinutes :
      misConfig.syncAccountUser.maxSyncDurationMinutes,
  });
  await em.persistAndFlush(newAccountUserSync);
  logger.trace("A synchronization started: %o", newAccountUserSync);

  const clustersSyncResults: ClusterTotalSyncResultProto[] = [];

  processSynchronization(
    sessionId,
    currentActivatedClusters,
    em,
    logger,
    clusterPlugin,
    scowResourcePlugin,
    maxSyncDurationMinutes,
  ).catch(async (e) => {
    logger.error(e, "Account User Synchronization task failed.");

    // 在同步集群中向每一个集群写入异常结果
    Object.keys(currentActivatedClusters).map((clusterId) => {
      const clusterResult: ClusterTotalSyncResultProto = {
        clusterId,
        clusterSyncStatus: SyncStatusProto.UNEXECUTED,
        clusterSyncResult: SyncResultProto.FAILED,
        executedChunkCount: 0,
        isAllChunkExecuted: true,
        clusterSyncExceptions: [{
          exceptionType: SyncExceptionTypeProto.CLUSTER_UNEXECUTED,
          exceptionMessage: "Error occurred during the synchronization task.",
        }],
        successfulTotalSyncCount: 0,
        completedTotalSyncCount: 0,
      };
      clustersSyncResults.push(clusterResult);
    });

    newAccountUserSync.syncDetails = clustersSyncResults;
    newAccountUserSync.syncStatus = SyncStatus.UNEXECUTED;
    newAccountUserSync.syncResult = SyncResult.FAILED;
    await em.persistAndFlush(newAccountUserSync);

  });

  return sessionId.toString();
}
