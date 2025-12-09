import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { Loaded, LockMode, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { createAdapterCertificates, getSchedulerAdapterClient,
  SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { checkSchedulerApiVersion } from "@scow/lib-server";
import { ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult as ClusterTotalSyncResultProto,
  ListAccountUserSynchronizationsResponse_ExceptionDetail,
  ListAccountUserSynchronizationsResponse_SyncDetailsSummary as SyncDetailsSummaryProto,
  ListAccountUserSynchronizationsResponse_SyncExceptionType as SyncExceptionTypeProto,
  ListAccountUserSynchronizationsResponse_SyncResult as SyncResultProto,
  ListAccountUserSynchronizationsResponse_SyncStatus as SyncStatusProto } from "@scow/protos/build/server/admin";
import { SyncAccountInfo, SyncAccountUserInfoResponse_SyncOperationResult }
  from "@scow/scheduler-adapter-protos/build/protos/account";
import { PartitionNames } from "@scow/scow-resource-protos/build/partition_pb";
import { ApiVersion } from "@scow/utils/build/version";
import { Logger } from "pino";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
import { misConfig } from "src/config/mis";
import { Account, AccountState } from "src/entities/Account";
import { AccountUserSyncRecord, SyncResult, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { UserState } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { ClusterPlugin } from "src/plugins/clusters";

import { logger } from "./logger";

export async function processSynchronization(
  sessionId: string,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin["clusters"],
  scowResourcePlugin?: ScowResourcePlugin["resource"],
  maxSyncDurationMinutes?: number,
) {

  return await em.transactional(async (em) => {

    // 如果没找到当前 Session ID 下需要同步的数据, 抛出错误
    const syncRecord = await em.findOne(AccountUserSyncRecord, {
      sessionId,
    });
    logger.trace("Account user Synchronization record is found, %o", syncRecord);

    if (!syncRecord || syncRecord.syncStatus !== SyncStatus.RUNNING) {
      throw {
        code: Status.NOT_FOUND,
        message: "The synchronization task is not found.",
      } as ServiceError;
    }

    // 如果一个在线集群都没有，抛出错误
    const currentActivatedClusterIds = Object.keys(currentActivatedClusters);
    logger.trace("Current activated clusters for synchronization, %s", currentActivatedClusterIds.join(","));

    if (currentActivatedClusterIds.length === 0) {
      throw {
        code: Status.NOT_FOUND,
        message: "There is no activated clusters for synchronization.",
      } as ServiceError;
    }

    // 获取当前账户用户信息
    const accounts = await getSyncTotalAccountUsersWithReadLock(em, logger);

    logger.trace("Accounts with userAccount data (length: %s) "
      + "will be with a read lock during the whole synchronization", accounts.length);

    // 避免切片处理中重复创建，提前获取各集群适配器连接
    // 对没有成功建立适配器连接的在线集群，保存集群同步失败信息
    const adapterClientPool = await getActivatedClusterSchedulerClients(currentActivatedClusters, logger);
    const clientClusterIds = Object.keys(adapterClientPool);

    logger.trace("Current available scheduler adapter client clusters: %s", clientClusterIds.join(","));
    const clustersSyncResults: ClusterTotalSyncResultProto[] = [];
    currentActivatedClusterIds.forEach((clusterId) => {

      if (!clientClusterIds.includes(clusterId)) {
        logger.trace("Some cluster account user synchronization is failed. "
          + "Can not find client of cluster: %s", clusterId);
        const clusterResult: ClusterTotalSyncResultProto = {
          clusterId,
          clusterSyncStatus: SyncStatusProto.UNEXECUTED,
          clusterSyncResult: SyncResultProto.FAILED,
          executedChunkCount: 0,
          isAllChunkExecuted: true,
          clusterSyncExceptions: [{
            exceptionType: SyncExceptionTypeProto.CLUSTER_UNEXECUTED,
            exceptionMessage:
              "Calling actions on non-existing cluster or incompatible scheduler adapter version.",
          }],
          completedTotalSyncCount: 0,
          successfulTotalSyncCount: 0,
        };
        clustersSyncResults.push(clusterResult);
      }
    });
    // 如果有错误数据，更新错误数据
    await persistAndFlushSyncRecord(em, syncRecord, { syncDetails: clustersSyncResults });

    // ************************************* 对数据进行切片处理 ***********************************************
    const FIXED_CHUNK_SIZE = 20;
    const maxSyncDurationMilliseconds =
      (maxSyncDurationMinutes || misConfig.syncAccountUser.maxSyncDurationMinutes) * 60 * 1000;

    let startIndex: number = 0;
    const chunkSize: number = FIXED_CHUNK_SIZE;
    let chunkIndex: number = 1;
    const isResourceDeployed = !!commonConfig.scowResource?.enabled;

    logger.info(
      "Start an account user synchronization with maxSyncDurationMinutes : %s", maxSyncDurationMinutes);

    const clustersTimeUsed: Record<string, number> = {};
    const clustersShouldContinue: Record<string, boolean> = {};

    const clusterLastChunkEndTime: Record<string, number> = {};

    // 数据切片处理
    while (startIndex < accounts.length) {

      const isLastChunk = startIndex + FIXED_CHUNK_SIZE >= accounts.length;
      // 获取当前分片的数据
      const chunkAccounts =
      accounts.length < FIXED_CHUNK_SIZE ? accounts : accounts.slice(startIndex, startIndex + FIXED_CHUNK_SIZE);

      // 多集群并发
      await Promise.allSettled(
        Object.entries(adapterClientPool).map(async ([clusterId, clusterClient]) => {

          // 初始化
          if (clustersTimeUsed[clusterId] === undefined) clustersTimeUsed[clusterId] = 0;
          if (clustersShouldContinue[clusterId] === undefined) clustersShouldContinue[clusterId] = true;

          if (clusterLastChunkEndTime[clusterId]) {
            const clusterChunkElapsedTime = Date.now() - clusterLastChunkEndTime[clusterId];
            clustersTimeUsed[clusterId] += clusterChunkElapsedTime;

            logger.trace("[Cluster: %s] Max sync duration time: %s minutes, [ Chunk %s ] execution time %s seconds, "
              + "total used %s seconds, remaining %s seconds", clusterId, maxSyncDurationMinutes, chunkIndex - 1,
            clusterChunkElapsedTime / 1000, clustersTimeUsed[clusterId] / 1000,
            (maxSyncDurationMilliseconds - clustersTimeUsed[clusterId]) / 1000);

          }

          const remainingMillisecondsForCluster = maxSyncDurationMilliseconds - clustersTimeUsed[clusterId];
          // 如果当前集群已不能继续则不再请求
          if (!clustersShouldContinue[clusterId] || remainingMillisecondsForCluster <= 0) {
            logger.warn(
              "[Cluster %s] Skipping further synchronization due to maxSyncDurationMinutes %s minutes are exceeded",
              clusterId, maxSyncDurationMinutes);

            // 更新数据库，增加超时异常记录
            const clusterResult: ClusterTotalSyncResultProto = {
              clusterId,
              clusterSyncStatus: isLastChunk ?
                SyncStatusProto.COMPLETED :
                SyncStatusProto.RUNNING,
              // 未发送请求，chunk数减1
              executedChunkCount: chunkIndex - 1,
              isAllChunkExecuted: isLastChunk,
              completedTotalSyncCount: 0,
              successfulTotalSyncCount: 0,
              clusterSyncExceptions: [
                {
                  exceptionType: SyncExceptionTypeProto.MAX_EXECUTION_TIME_EXCEEDED,
                  exceptionMessage: "Synchronization is not completely executed due to exceeding "
                    + `the maximum sync time ${maxSyncDurationMinutes} minutes`,
                },
              ],
            };
            await persistAndFlushSyncRecord(em, syncRecord, { syncDetails: [clusterResult]});
            return;
          }

          // 记录当前集群本次chunk内执行开始时间
          clusterLastChunkEndTime[clusterId] = Date.now();

          const syncAccountsResult = await getSyncAccountsWithPartitions(
            clusterId,
            currentActivatedClusters,
            chunkAccounts,
            isResourceDeployed,
            logger,
            scowResourcePlugin,
          );
          const syncAccountsData = syncAccountsResult.syncAccounts;
          logger.trace("[Cluster %s] Accounts to execute synchronization in chunk %s: %o",
            clusterId, chunkIndex, syncAccountsData);

          // 如果有授权分区获取失败的账户
          // 更新数据库到对应失败结果
          if (syncAccountsResult.partitionsFetchFailedAccounts?.length) {
            logger.info(
              "[Cluster %s] Assigned partitions fetch failed in the accounts: %s , "
              + "the synchronization will skip in them.",
              clusterId, syncAccountsResult.partitionsFetchFailedAccounts.join(","));
            const currentClusterTotalResult: ClusterTotalSyncResultProto = {
              clusterId,
              clusterSyncStatus: SyncStatusProto.RUNNING,
              clusterSyncResult: SyncResultProto.FAILED,
              executedChunkCount: chunkIndex,
              isAllChunkExecuted: isLastChunk,
              clusterSyncExceptions: [
                {
                  exceptionType:
                    SyncExceptionTypeProto.ASSIGNED_PARTITIONS_FETCH_FAILED,
                  exceptionMessage: syncAccountsResult.partitionsFetchFailedAccounts.join(","),
                },
              ],
              completedTotalSyncCount: 0,
              successfulTotalSyncCount: 0,
            };
            await persistAndFlushSyncRecord(em, syncRecord, { syncDetails: [currentClusterTotalResult]});
          }

          // 如果有没有拥有者的账户, 只在日志中做出提示
          if (syncAccountsResult.abnormalAccountsWithoutOwner?.length) {
            logger.warn(
              "Abnormal accounts without owner were found: %s, "
              + "the synchronization will still synchronize them to cluster.",
              syncAccountsResult.abnormalAccountsWithoutOwner.join(","));
          }

          logger.trace("[Cluster %s] ***Start Sync in chunk %s with time limit %s seconds***",
            clusterId, chunkIndex, remainingMillisecondsForCluster / 1000,
          );

          await clusterPlugin.callOnOneClient(
            clusterId,
            logger,
            clusterClient,
            async (client) => {
              const clusterChunkResult = await asyncClientCall(client.account, "syncAccountUserInfo", {
                sessionId,
                syncAccounts: syncAccountsData,
                timeoutMilliseconds: remainingMillisecondsForCluster,
              });

              let timeoutException: ListAccountUserSynchronizationsResponse_ExceptionDetail | undefined = undefined;
              // 检查本次chunk内是否在限制时间内已全部执行
              if (clusterChunkResult.completelyExecuted === false) {
                logger.warn(
                  "[Cluster %s] Synchronization not completely executed within time limit %s seconds in chunk %s",
                  clusterId, remainingMillisecondsForCluster / 1000, chunkIndex);
                clustersShouldContinue[clusterId] = false;
                timeoutException = {
                  exceptionType: SyncExceptionTypeProto.MAX_EXECUTION_TIME_EXCEEDED,
                  exceptionMessage: "Synchronization is not completely executed due to exceeding "
                  + `the maximum sync time ${maxSyncDurationMinutes} minutes`,
                };
              }

              // 如果本次Chunk内在正常执行，但是没有返回值则没有需要同步的数据
              // 更新这个结果到数据库
              if (clusterChunkResult.syncResults.length === 0) {
                logger.trace(
                  "[Cluster: %s] No data need to be synchronized in this chunk: %s.",
                  clusterId, chunkIndex);
                const clusterResult: ClusterTotalSyncResultProto = {
                  clusterId,
                  clusterSyncStatus: isLastChunk || clusterChunkResult.completelyExecuted === false ?
                    SyncStatusProto.COMPLETED :
                    SyncStatusProto.RUNNING,
                  executedChunkCount: chunkIndex,
                  isAllChunkExecuted: isLastChunk,
                  completedTotalSyncCount: 0,
                  successfulTotalSyncCount: 0,
                  clusterSyncExceptions: timeoutException ? [timeoutException] : [],
                };
                await persistAndFlushSyncRecord(em, syncRecord, { syncDetails: [clusterResult]});
              }
              // 如果本次Chunk内在正常执行，有同步结果的返回数据
              // 更新这个结果到数据库
              if (clusterChunkResult.syncResults.length > 0) {
                logger.trace(
                  "[Cluster: %s] Chunk (index: %s) sync result: %o, completelyExecuted is %s",
                  clusterId, chunkIndex, clusterChunkResult.syncResults, clusterChunkResult.completelyExecuted);

                const currentClusterTotalResult: ClusterTotalSyncResultProto = {
                  clusterId,
                  clusterSyncStatus: isLastChunk || clusterChunkResult.completelyExecuted === false ?
                    SyncStatusProto.COMPLETED :
                    SyncStatusProto.RUNNING,
                  executedChunkCount: chunkIndex,
                  isAllChunkExecuted: isLastChunk,
                  completedTotalSyncCount: clusterChunkResult.syncResults.length,
                  successfulTotalSyncCount: clusterChunkResult.syncResults.filter((x) => x.success)?.length,
                  clusterSyncExceptions: timeoutException ? [timeoutException] : [],
                  clusterSyncDetails: transformToUpdatedSummaryMap(clusterChunkResult.syncResults),
                };
                await persistAndFlushSyncRecord(em, syncRecord, { syncDetails: [currentClusterTotalResult]});
              }
            },

          // 如果本次Chunk发生错误，记录异常信息
          // 更新这个结果到数据库
          ).catch(async (e) => {
            logger.error("[Cluster: %s] Error occurred during account user synchronization in synchronization "
              + "chunk: %s, details: %o", clusterId, chunkIndex, e);

            const currentClusterTotalResult: ClusterTotalSyncResultProto = {
              clusterId,
              clusterSyncStatus: isLastChunk ?
                SyncStatusProto.COMPLETED :
                SyncStatusProto.RUNNING,
              clusterSyncResult: SyncResultProto.FAILED,
              executedChunkCount: chunkIndex,
              isAllChunkExecuted: isLastChunk,
              clusterSyncExceptions: [
                {
                  exceptionType: SyncExceptionTypeProto.CHUNK_FAILED,
                  exceptionMessage: "Chunk failed.",
                },
              ],
              successfulTotalSyncCount: 0,
              completedTotalSyncCount: 0,
            };

            await persistAndFlushSyncRecord(em, syncRecord, { syncDetails: [currentClusterTotalResult]});
          });
        }),

      );

      // 更新分片索引
      startIndex += chunkSize;
      chunkIndex++;
    };
    // ************************************* 对数据进行切片结束 ***********************************************

    // 所有数据处理结束时
    // 更新此次数据同步任务状态为 COMPLETED 到数据库
    const newRecordItems: Partial<AccountUserSyncRecord> = {
      syncStatus: SyncStatus.COMPLETED,
    };

    await persistAndFlushSyncRecord(em, syncRecord, newRecordItems);
  });
}

/**
 * 映射返回的同步操作结果为SyncDetailsSummaryMap类型
 * @param syncResults
 * @returns SyncDetailsSummaryMap结果
 */
export function transformToUpdatedSummaryMap(
  syncResults: SyncAccountUserInfoResponse_SyncOperationResult[],
): SyncDetailsSummaryProto {

  const summary: SyncDetailsSummaryProto = {};

  syncResults.forEach((sr) => {
    const { syncOperation, success, failureMessage } = sr;

    switch (syncOperation?.$case) {
      case "createAccount":
        {
          summary.createAccount = summary.createAccount || { results: []};
          summary.createAccount.results.push({
            accountName: syncOperation.createAccount.accountName,
            success,
            failureMessage,
          });
        }
        break;
      case "blockAccount":
        {
          summary.blockAccount = summary.blockAccount || { results: []};
          summary.blockAccount.results.push({
            accountName: syncOperation.blockAccount.accountName,
            success,
            failureMessage,
          });
        }
        break;
      case "unblockAccount":
        {
          summary.unblockAccount = summary.unblockAccount || { results: []};
          summary.unblockAccount.results.push({
            accountName: syncOperation.unblockAccount.accountName,
            success,
            failureMessage,
          });
        }
        break;
      case "addUserToAccount":
        {
          summary.addUserToAccount = summary.addUserToAccount || { results: []};
          summary.addUserToAccount.results.push({
            accountName: syncOperation.addUserToAccount.accountName,
            userId: syncOperation.addUserToAccount.userId,
            success,
            failureMessage,
          });
        }

        break;
      case "blockUserInAccount":
        {
          summary.blockUserInAccount = summary.blockUserInAccount || { results: []};
          summary.blockUserInAccount.results.push({
            accountName: syncOperation.blockUserInAccount.accountName,
            userId: syncOperation.blockUserInAccount.userId,
            success,
            failureMessage,
          });
        }

        break;
      case "unblockUserInAccount":
        {
          summary.unblockUserInAccount = summary.unblockUserInAccount || { results: []};
          summary.unblockUserInAccount.results.push({
            accountName: syncOperation.unblockUserInAccount.accountName,
            userId: syncOperation.unblockUserInAccount.userId,
            success,
            failureMessage,
          });
        }
        break;
      case "removeUserFromAccount":
        {
          summary.removeUserFromAccount = summary.removeUserFromAccount || { results: []};
          summary.removeUserFromAccount.results.push({
            accountName: syncOperation.removeUserFromAccount.accountName,
            userId: syncOperation.removeUserFromAccount.userId,
            success,
            failureMessage,
          });
        }
        break;
    }
  });

  logger.trace("Synchronization details summary map: %o", summary);
  return summary;
};


/**
 * 更新同步详情，相同类别保存在一起
 * @param lastSummary 原有同步详情
 * @param currentSummary 当前需要写入的同步详情
 * @returns 聚合后的同步详情
 */
export function updateSyncDetails(
  lastSummary: SyncDetailsSummaryProto,
  currentSummary: SyncDetailsSummaryProto,
): SyncDetailsSummaryProto {
  const mergedSummary: SyncDetailsSummaryProto = {};

  // 遍历上一次结果
  for (const key in lastSummary) {
    if (Object.hasOwnProperty.call(lastSummary, key)) {
      const value1 = lastSummary[key];
      const value2 = currentSummary[key];

      // 如果 key 在当前 summary 中也有对应值，合并
      if (value2) {
        if (Array.isArray(value1?.results) && Array.isArray(value2?.results)) {
          // 合并 results 数组
          mergedSummary[key] = {
            results: [...value1.results, ...value2.results],
          };
        } else {
          mergedSummary[key] = value1;
        }
      } else {
        // 如果当前 summary 没有该 key，直接复制 lastSummary 的值
        mergedSummary[key] = value1;
      }
    }
  }

  // 遍历当前 summary，确保没有遗漏的 key
  for (const key in currentSummary) {
    if (Object.hasOwnProperty.call(currentSummary, key) && !Object.hasOwnProperty.call(mergedSummary, key)) {
      mergedSummary[key] = currentSummary[key];
    }
  }

  return mergedSummary;
}

/**
 * 获取本次整个同步账户用户数据过程中的账户用户数据，并获取Account与UserAccount的读锁
 * @param em
 * @param logger
 * @returns 如果没有数据则抛出错误，不会进行同步
 */
export async function getSyncTotalAccountUsersWithReadLock(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger): Promise<Loaded<Account, "tenant" | "users" | "users.user">[]> {

  logger.info("Adding pessimistic read locks to 'Account' and 'UserAccount' tables. "
    + "Write operations on these tables may be blocked during the synchronization.");
  // 对 Account 加锁
  const dbAccounts = await em.createQueryBuilder(Account)
    .setLockMode(LockMode.PESSIMISTIC_READ)
    .getResultList();

  // 对 UserAccount 表加锁
  await em.createQueryBuilder(UserAccount)
    .setLockMode(LockMode.PESSIMISTIC_READ)
    .getResultList();

  // 加载关联实体
  const accounts = await em.populate(dbAccounts, ["tenant", "users", "users.user"]);
  if (accounts.length === 0) {
    logger.error("No accounts for synchronization.");
    throw {
      code: Status.NOT_FOUND,
      message: "Accounts with users for synchronization task are not found.",
    } as ServiceError;
  }

  return accounts;

};

/**
 * 获取当前所有在线可用集群的适配器连接，避免每个切片内重复连接
 * @param currentActivatedClusters
 * @param logger
 * @returns 如果无法获取适配器连接或适配器版本不符合要求则不返回
 *          如果所有适配器连接都无法正常取得则抛出错误
 */
export async function getActivatedClusterSchedulerClients(
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  logger: Logger,
): Promise<Record<string, SchedulerAdapterClient>> {

  const certificates = createAdapterCertificates(config);
  const adapterClientPool: Record<string, SchedulerAdapterClient> = {};

  const failedExecutedClusterIds: string[] = [];

  for (const [clusterId, cluster] of Object.entries(currentActivatedClusters)) {

    const client = getSchedulerAdapterClient(cluster.adapterUrl, certificates);

    if (!client) {
      // 如果创建客户端失败，记录失败的集群 ID，在此次同步操作中跳过该集群操作
      logger.info("Calling actions on non-existing cluster " + clusterId);
      failedExecutedClusterIds.push(clusterId);
    } else {
      // 检查适配器版本是否一致
      // 当前接口要求的最低调度器接口版本 1.9.0
      const minRequiredApiVersion: ApiVersion = { major: 1, minor: 9, patch: 0 };
      try {
      // 检验调度器的API版本是否符合要求，不符合要求报错
        await checkSchedulerApiVersion(client, minRequiredApiVersion);
        adapterClientPool[clusterId] = client;
      } catch (e) {
        const error = e as ServiceError;
        if (error) {
          logger.error("Cluster %s scheduler adapter version is not compatible, %o", clusterId, error);
          failedExecutedClusterIds.push(clusterId);
        }
      }
    };

  }
  // 如果所有适配器建立连接均失败扔出报错
  if (failedExecutedClusterIds.length === Object.keys(currentActivatedClusters).length) {
    throw {
      code: Status.NOT_FOUND,
      message: "Clusters for synchronization task are not found.",
    } as ServiceError;
  }

  return adapterClientPool;
}

interface GetSyncExecAccountsResponse {
  syncAccounts: SyncAccountInfo[];
  // 资源管理下获取已授权分区失败的账户无法进行同步操作
  partitionsFetchFailedAccounts?: string[];
  // 没有拥有者的异常账户
  abnormalAccountsWithoutOwner?: string[];
}

/**
 * 在部署了资源管理系统的前提下，获取账户用户数据中的账户已授权分区
 * @param clusterId 分区对应的集群id
 * @param currentActivatedClusters 当前在线可用集群
 * @param accounts 当前需要查找已授权分区的账户数据
 * @param isResourceDeployed 是否部署了资源管理系统
 * @param logger
 * @param scowResourcePlugin
 * @returns 返回需要执行同步操作的账户数据以及获取已授权分区失败的账户名数组
 */
export async function getSyncAccountsWithPartitions(
  clusterId: string,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  accounts: Loaded<Account, "tenant" | "users" | "users.user">[],
  isResourceDeployed: boolean,
  logger: Logger,
  scowResourcePlugin?: ScowResourcePlugin["resource"],
): Promise<GetSyncExecAccountsResponse> {
  let partitionsFetchFailedAccounts: string[] = [];
  const abnormalAccountsWithoutOwner: string[] = [];

  // 只查询状态为在集群下解封的账户授权分区
  const queryAccounts = accounts.filter((account) => {
    return account.whitelist?.id || !account.blockedInCluster;
  }).map((account) => ({
    accountName: account.accountName,
    tenantName: account.tenant.getProperty("name") }));

  let syncAccounts: SyncAccountInfo[] = [];

  const reply: Record<string, PartitionNames> | undefined = isResourceDeployed ?
    await scowResourcePlugin?.getAccountsAssignedPartitionsForCluster({
      accountsWithTenants: queryAccounts, clusterId,
    }).catch((e) => {
      // 因为一个chunk内的账户不一定都是在集群下解封状态
      // 所以获取授权分区失败的账户+仍然只做记录，不取消本次chunk
      partitionsFetchFailedAccounts = queryAccounts.map((a) => (a.accountName));
      logger.error(
        "[Cluster: %s] Fetch assigned partitions of [%s] failed, %o",
        clusterId, partitionsFetchFailedAccounts.join(","), e);
      return undefined;
    }) : undefined;

  logger.trace("[Cluster: %s] Partitions fetched of [%o]", clusterId, reply);

  syncAccounts = accounts
    .filter((account) => {
      const owner = account.users.find((x) => (x.role === UserRole.OWNER))?.user.getProperty("userId");

      // 如果不存在拥有者，保留该账户进行同步，只返回不存在拥有者的数组方便后端留存特殊日志
      if (!owner) {
        abnormalAccountsWithoutOwner.push(account.accountName);
      }
      // 过滤排除分区获取异常的账户
      return !partitionsFetchFailedAccounts?.includes(account.accountName);
    })
    .map((account) => {
      const mappedAccount: SyncAccountInfo = {
        accountName: account.accountName,
        users: account.users.map((user) => {
          return {
            userId: user.user.getProperty("userId"),
            blocked: user.blockedInCluster === UserStatus.BLOCKED,
            deleted: user.user.getProperty("state") === UserState.DELETED,
          };
        }),
        ownerId: account.users.find((x) => (x.role === UserRole.OWNER))?.user.getProperty("userId"),
        whitelistId: account.whitelist?.id,
        blockedInCluster: account.blockedInCluster,
        // 未部署资源管理时默认使用全部分区数据
        // 部署了资源管理时，使用已授权分区
        unblockedPartitions: !isResourceDeployed ?
          { $case: "useAllPartitions", useAllPartitions: true }
          : { $case: "assignedPartitions",
            assignedPartitions:
              { partitions: reply?.[account.accountName]?.partitionNames ?? []} },
        deleted: account.state === AccountState.DELETED,
      };
      return mappedAccount;
    });

  return {
    syncAccounts: syncAccounts,
    partitionsFetchFailedAccounts,
    abnormalAccountsWithoutOwner,
  };
}

/**
 * 更新当前账户用户同步操作记录
 * 如果集群下的isAllChunkExecuted === true时，
 * 判断异常及成功操作条数，更新这个集群的 clusterSyncResult 是 SUCCESS 还是 FAILED；
 * 如果newUpdateItems的SyncStatus === COMPLETED时，
 * 判断异常及成功操作条数，更新这条记录的 SyncResult 为 SUCCESS 还是 FAILED
 * @param em
 * @param originSyncRecord 已经保存在数据库中的同步记录
 * @param newUpdateItems 现在想要更新的同步记录
 * @param needFlush 是否需要持久化
 * @returns 更新过的账户用户同步操作记录
 */
export async function persistAndFlushSyncRecord(
  em: SqlEntityManager<MySqlDriver>,
  originSyncRecord: Loaded<AccountUserSyncRecord>,
  newUpdateItems: Partial<AccountUserSyncRecord>,
): Promise<Loaded<AccountUserSyncRecord>> {

  logger.trace("Update account user sync record from current record %o to new record with items %o",
    originSyncRecord, newUpdateItems);

  const getClusterFinalSyncResult =
    (recordSyncResult: ClusterTotalSyncResultProto):
    SyncResultProto => {
      const hasException = recordSyncResult.clusterSyncExceptions && recordSyncResult.clusterSyncExceptions.length > 0;
      const hasFailedResult = recordSyncResult.successfulTotalSyncCount < recordSyncResult.completedTotalSyncCount;
      const isFailed = hasException || hasFailedResult;
      return isFailed ?
        SyncResultProto.FAILED :
        SyncResultProto.SUCCESS;
    };

  // 合并 syncDetails
  const newSyncDetails: ClusterTotalSyncResultProto[] = newUpdateItems.syncDetails || [];
  const originSyncDetails: ClusterTotalSyncResultProto[] = originSyncRecord.syncDetails || [];

  const originSyncDetailsClusterIds = originSyncDetails.map((s) => (s.clusterId));
  newSyncDetails.forEach((newResult) => {
    // 如果当前数据库中不存在syncDetails，直接赋值
    if (!originSyncDetailsClusterIds.includes(newResult.clusterId)) {

      // 判断是否需要更新 clusterSyncResult
      // 只在 isAllChunkExecuted === true时，更新
      if (newResult.isAllChunkExecuted) {
        newResult.clusterSyncResult = getClusterFinalSyncResult(newResult);
      }
      originSyncDetails.push(newResult);
    } else {
      // 存在相同的clusterId，进行累加
      const originClusterResult =
        originSyncDetails.find((s) => (s.clusterId === newResult.clusterId)) ?? {} as ClusterTotalSyncResultProto;

      originClusterResult.completedTotalSyncCount += newResult.completedTotalSyncCount;
      originClusterResult.successfulTotalSyncCount += newResult.successfulTotalSyncCount;

      if (newResult.clusterSyncExceptions?.length) {
        originClusterResult.clusterSyncExceptions = originClusterResult.clusterSyncExceptions || [];
        originClusterResult.clusterSyncExceptions.push(...newResult.clusterSyncExceptions);
      }
      if (newResult.clusterSyncDetails) {
        originClusterResult.clusterSyncDetails =
          updateSyncDetails(originClusterResult.clusterSyncDetails || {}, newResult.clusterSyncDetails);
      }

      // 更新 executedChunk, isAllChunkExecuted 及 clusterSyncStatus
      originClusterResult.executedChunkCount = newResult.executedChunkCount;
      originClusterResult.isAllChunkExecuted = newResult.isAllChunkExecuted;
      originClusterResult.clusterSyncStatus = newResult.clusterSyncStatus;

      if (!newResult.clusterSyncResult && newResult.isAllChunkExecuted) {
        // 利用更新后的数据，获取集群最终同步状态
        originClusterResult.clusterSyncResult = getClusterFinalSyncResult(originClusterResult);
      } else {
        originClusterResult.clusterSyncResult = newResult.clusterSyncResult;
      }
    }
  });

  // 更新其他元素值 syncStatus 等
  originSyncRecord = Object.assign(originSyncRecord, newUpdateItems);
  originSyncRecord.syncDetails = originSyncDetails;

  // 如果已全部执行结束更新 SyncResult
  if (!originSyncRecord.syncResult && originSyncRecord.syncStatus === SyncStatus.COMPLETED) {
    let isFailed: boolean = false;
    const syncDetails: ClusterTotalSyncResultProto[] = originSyncRecord.syncDetails || [];
    isFailed = Object.values(syncDetails).some((s) => {
      const clusterSyncResult = s.clusterSyncResult;
      return clusterSyncResult !== undefined && clusterSyncResult === SyncResultProto.FAILED;
    });
    originSyncRecord.syncResult = isFailed ? SyncResult.FAILED : SyncResult.SUCCESS;
    logger.trace("The synchronization result is updated to %o.", originSyncRecord.syncResult);
  }

  await em.persistAndFlush(originSyncRecord);

  logger.trace("Account user synchronization record is updated, the new record is %o",
    originSyncRecord);

  return originSyncRecord;
}

/**
 * 确保没有正在运行的同步任务，防止账户或用户数据冲突
 * @param taskNameForErrorMessage 在抛出错误中显示当前任务处理名称
 * @throws 如果有正在运行的有效的同步任务，则抛出 ServiceError
 */
export async function ensureNoRunningSyncTask(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  taskNameForErrorMessage: string,
): Promise<void> {

  return await em.transactional(async (em) => {
    // 增加写锁，防止检查异常运行事务存在出现锁竞争
    const isSyncRunningFound = await em.findOne(AccountUserSyncRecord, { syncStatus: SyncStatus.RUNNING }, {
      lockMode: LockMode.PESSIMISTIC_WRITE,
    });
    const validRunningExists = await checkValidRunningSyncRecord(em, logger, isSyncRunningFound);

    if (validRunningExists) {
      throw new ServiceError({
        code: Status.FAILED_PRECONDITION,
        details: "Account User Synchronization is running. "
        + `Please wait for its completion before starting the ${taskNameForErrorMessage}.`,
      });
    }
  });
}

/**
 * 检查当前是否存在正在运行的同步任务
 * 如果存在返回true,不存在返回false
 * 如果存在异常的同步任务，会被更新为失败，并返回false
 * @param isDuringSystemStarting 是否是在系统启动时的检查
 */
export async function checkRunningSyncTask(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  isDuringSystemStarting?: boolean,
): Promise<boolean> {

  return await em.transactional(async (em) => {
    // 增加写锁，防止检查异常运行事务存在出现锁竞争
    const isSyncRunningFound = await em.findOne(AccountUserSyncRecord, { syncStatus: SyncStatus.RUNNING }, {
      lockMode: LockMode.PESSIMISTIC_WRITE,
    });
    const exist = await checkValidRunningSyncRecord(em, logger, isSyncRunningFound, isDuringSystemStarting);
    return exist;
  });
}

/**
 * 检查当前同步任务是否为正常的同步任务
 * 1. 如果是已超时的同步任务，会被更新为失败, 并返回false
 * 2. 如果是系统启动检查中发现的同步任务，会被立即跟新为失败, 并返回false
 * 3. 如果不是系统启动检查，也没有超时，则返回true
 *
 * @param runningSyncRecord 正在运行的同步任务记录
 * @param isDuringSystemStarting 是否是在系统启动时的检查
 */
async function checkValidRunningSyncRecord(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  runningSyncRecord?: Loaded<AccountUserSyncRecord, never, "*", never> | null,
  isDuringSystemStarting?: boolean,
): Promise<boolean> {

  if (!runningSyncRecord) {
    logger.info("No account user synchronization task is found.");
    return false;
  }
  // 如果是系统启动时的判断，存在running数据即更新记录为已结束
  if (isDuringSystemStarting) {
    logger.warn("An abnormal account user synchronization task is found during system start. "
      + "It will be updated to FAILED.");
    await UpdateStuckRunningSyncRecord(em, logger, runningSyncRecord);
    return false;
  }

  logger.info("Checking whether the currently running account user synchronization task is valid.");
  const maxSyncMinutes = runningSyncRecord.maxSyncDurationMinutes || misConfig.syncAccountUser.maxSyncDurationMinutes;
  const maxSyncDurationMilliseconds = maxSyncMinutes * 60 * 1000;
  const runningProcessTime = Date.now() - runningSyncRecord.startTime.getTime();
  // 判断开始时间是否已超过最大时间
  // 增加一分钟冗余时间做判断
  // 如果超过更新数据为超时
  const TIMEOUT_BUFFER_MILLISECONDS = 60 * 1000;
  if ((runningProcessTime + TIMEOUT_BUFFER_MILLISECONDS) > maxSyncDurationMilliseconds) {
    const checkModeMessage = isDuringSystemStarting ? "system error" : "timeout";
    logger.warn("An abnormal account user synchronization task caused by %s is found. It will be updated to FAILED.",
      checkModeMessage);
    await UpdateStuckRunningSyncRecord(em, logger, runningSyncRecord, maxSyncMinutes);
    return false;
  }
  logger.info("The running account user synchronization task is valid.");
  return true;

}


/**
 * 更新异常的正在运行的同步账户用户信息记录
 * @param maxSyncMinutes 超时是数据更新，需要传递此数据用于错误记录；不存在则认为是异常原因
 */
async function UpdateStuckRunningSyncRecord(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  runningSyncRecord: Loaded<AccountUserSyncRecord>,
  maxSyncMinutes?: number,
): Promise<void> {

  logger.info("Starting update abnormal running account user synchronization record.");
  const errorModeMessage = maxSyncMinutes ? `exceeding the maximum sync time ${maxSyncMinutes} minutes`
    : "unknown error";
  const exceptionType = maxSyncMinutes ?
    SyncExceptionTypeProto.MAX_EXECUTION_TIME_EXCEEDED
    : SyncExceptionTypeProto.EXCEPTION_UNKNOWN;

  runningSyncRecord.syncResult = SyncResult.FAILED;
  if (!runningSyncRecord.syncDetails) {
    // 更新整个同步结果为未执行
    runningSyncRecord.syncStatus = SyncStatus.UNEXECUTED;
    await em.persistAndFlush(runningSyncRecord);
  } else {
    // 更新整个同步结果为结束
    runningSyncRecord.syncStatus = SyncStatus.COMPLETED;
    // 更新同步的各集群 状态/结果/异常
    const updatedClusterResults: ClusterTotalSyncResultProto[]
          = runningSyncRecord.syncDetails?.map((clusterResult) => {
            return {
              ...clusterResult,
              clusterSyncStatus: SyncStatusProto.COMPLETED,
              clusterSyncResult: SyncResultProto.FAILED,
              executedChunkCount: 0,
              isAllChunkExecuted: true,
              completedTotalSyncCount: 0,
              successfulTotalSyncCount: 0,
              clusterSyncExceptions: [
                {
                  exceptionType: exceptionType,
                  exceptionMessage: `Synchronization is not completely executed due to ${errorModeMessage}`,
                },
              ],
            };
          });
    await persistAndFlushSyncRecord(em, runningSyncRecord, { syncDetails: updatedClusterResults });
  }

  logger.info("The abnormal running account user synchronization record is updated to FAILED.");

}



