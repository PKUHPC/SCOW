import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Metadata } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { Loaded, LockMode, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import {
  createAdapterCertificates,
  getSchedulerAdapterClient,
  SchedulerAdapterClient,
} from "@scow/lib-scheduler-adapter";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { mergeI18nStrings } from "@scow/lib-server";
import { TargetType } from "@scow/notification-protos/build/message_common_pb";
import {
  ListAccountUserSynchronizationsResponse_ClusterTotalSyncResult as ClusterTotalSyncResultProto,
  ListAccountUserSynchronizationsResponse_ExceptionDetail,
  ListAccountUserSynchronizationsResponse_SyncDetailsSummary as SyncDetailsSummaryProto,
  ListAccountUserSynchronizationsResponse_SyncExceptionType as SyncExceptionTypeProto,
  ListAccountUserSynchronizationsResponse_SyncResult as SyncResultProto,
  ListAccountUserSynchronizationsResponse_SyncStatus as SyncStatusProto,
} from "@scow/protos/build/server/admin";
import {
  SyncAccountInfo,
  SyncAccountUserInfoResponse_SyncOperationResult,
} from "@scow/scheduler-adapter-protos/build/account";
import { PartitionNames } from "@scow/scow-resource-protos/build/partition_pb";
import { Logger } from "pino";
import { configClusters } from "src/config/clusters";
import { config } from "src/config/env";
import { misConfig } from "src/config/mis";
import { Account, AccountState } from "src/entities/Account";
import { AccountUserSyncRecord, SyncResult, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { Cluster, ClusterActivationStatus } from "src/entities/Cluster";
import { PlatformRole, User, UserState } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { InternalMessageType, MessageStatus } from "src/models/messageType";
import { ClusterPlugin } from "src/plugins/clusters";

import { sendMessage } from "./sendMessage";

export async function processSynchronization(
  sessionId: string,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin["clusters"],
  scowResourcePlugin: ScowResourcePlugin["resource"],
  maxSyncDurationMinutes?: number,
) {
  const subLogger = logger.child({ name: "processSynchronization" });
  // 如果一个在线集群都没有，抛出错误
  const currentActivatedClusterIds = Object.keys(currentActivatedClusters);
  subLogger.trace("Current activated clusters for synchronization, %s", currentActivatedClusterIds.join(","));
  if (currentActivatedClusterIds.length === 0) {
    throw {
      code: Status.NOT_FOUND,
      message: "There is no activated clusters for synchronization.",
    } as ServiceError;
  }

  // 使用一个长事务维持事务中账户和账户用户的读锁
  return await em.transactional(async (em) => {
    // 如果没找到当前 Session ID 下需要同步的数据, 抛出错误
    const syncRecord = await em.findOne(AccountUserSyncRecord, {
      sessionId,
    });
    subLogger.trace("Account user Synchronization record is found, %o", syncRecord);

    if (!syncRecord || syncRecord.syncStatus !== SyncStatus.RUNNING) {
      throw {
        code: Status.NOT_FOUND,
        message: "The synchronization task is not found.",
      } as ServiceError;
    }

    // 获取当前账户用户信息
    const accounts = await getSyncTotalAccountUsersWithReadLock(em, subLogger);

    subLogger.info(
      "Accounts with userAccount data (length: %s) " + "will be with a read lock during the whole synchronization",
      accounts.length,
    );

    // 避免切片处理中重复创建，提前获取各集群适配器连接
    // 对没有成功建立适配器连接的在线集群，保存集群同步失败信息
    const adapterClientPool = await getActivatedClusterSchedulerClients(currentActivatedClusters, subLogger);
    const clientClusterIds = Object.keys(adapterClientPool);

    subLogger.trace("Current available scheduler adapter client clusters: %s", clientClusterIds.join(","));
    const clustersSyncResults: ClusterTotalSyncResultProto[] = [];
    currentActivatedClusterIds.forEach((clusterId) => {
      if (!clientClusterIds.includes(clusterId)) {
        subLogger.info(
          "Can not find client of cluster: %s, the synchronization will be updated to unexecuted",
          clusterId,
        );
        const clusterResult: ClusterTotalSyncResultProto = {
          clusterId,
          clusterSyncStatus: SyncStatusProto.UNEXECUTED,
          clusterSyncResult: SyncResultProto.FAILED,
          executedChunkCount: 0,
          isAllChunkExecuted: true,
          clusterSyncExceptions: [
            {
              exceptionType: SyncExceptionTypeProto.CLUSTER_UNEXECUTED,
              exceptionMessage: "Calling actions on non-existing cluster or incompatible scheduler adapter version.",
            },
          ],
          completedTotalSyncCount: 0,
          successfulTotalSyncCount: 0,
        };
        clustersSyncResults.push(clusterResult);
      }
    });

    if (clustersSyncResults.length > 0) {
      // 如果有错误数据，标记错误记录待保存
      await persistSyncRecord(em, syncRecord, { syncDetails: clustersSyncResults }, subLogger);
    }

    // ************************************* 对数据进行切片处理 ***********************************************
    const FIXED_CHUNK_SIZE = 20;
    const maxSyncDurationMilliseconds =
      (maxSyncDurationMinutes || misConfig.syncAccountUser.maxSyncDurationMinutes) * 60 * 1000;

    let startIndex: number = 0;
    const chunkSize: number = FIXED_CHUNK_SIZE;
    let chunkIndex: number = 1;

    subLogger.info("Start an account user synchronization with maxSyncDurationMinutes : %s", maxSyncDurationMinutes);

    const clustersTimeUsed: Record<string, number> = {};
    const clustersShouldContinue: Record<string, boolean> = {};

    const clusterLastChunkEndTime: Record<string, number> = {};

    // 数据切片处理
    while (startIndex < accounts.length) {
      const isLastChunk = startIndex + FIXED_CHUNK_SIZE >= accounts.length;
      // 获取当前分片的数据
      const chunkAccounts =
        accounts.length < FIXED_CHUNK_SIZE ? accounts : accounts.slice(startIndex, startIndex + FIXED_CHUNK_SIZE);

      const chunkResultsToPersist: ClusterTotalSyncResultProto[] = [];
      // 多集群并发
      const clusterClients = Object.entries(adapterClientPool);
      const clusterSyncTasks = await Promise.allSettled(
        clusterClients.map(async ([clusterId, clusterClient]) => {
          // 初始化
          if (clustersTimeUsed[clusterId] === undefined) clustersTimeUsed[clusterId] = 0;
          if (clustersShouldContinue[clusterId] === undefined) clustersShouldContinue[clusterId] = true;

          if (clusterLastChunkEndTime[clusterId]) {
            const clusterChunkElapsedTime = Date.now() - clusterLastChunkEndTime[clusterId];
            clustersTimeUsed[clusterId] += clusterChunkElapsedTime;

            subLogger.trace(
              "[Cluster: %s] Max sync duration time: %s minutes, [ Chunk %s ] execution time %s seconds, " +
                "total used %s seconds, remaining %s seconds",
              clusterId,
              maxSyncDurationMinutes,
              chunkIndex - 1,
              clusterChunkElapsedTime / 1000,
              clustersTimeUsed[clusterId] / 1000,
              (maxSyncDurationMilliseconds - clustersTimeUsed[clusterId]) / 1000,
            );
          }

          const remainingMillisecondsForCluster = maxSyncDurationMilliseconds - clustersTimeUsed[clusterId];
          // 1.如果当前集群已不能继续则不再请求
          // 保存这个结果到待写入数据库，增加超时异常记录
          if (!clustersShouldContinue[clusterId] || remainingMillisecondsForCluster <= 0) {
            subLogger.warn(
              "[Cluster %s] Skipping further synchronization due to maxSyncDurationMinutes %s minutes are exceeded",
              clusterId,
              maxSyncDurationMinutes,
            );

            const clusterResult: ClusterTotalSyncResultProto = {
              clusterId,
              clusterSyncStatus: isLastChunk ? SyncStatusProto.COMPLETED : SyncStatusProto.RUNNING,
              // 未发送请求，chunk数减1
              executedChunkCount: chunkIndex - 1,
              isAllChunkExecuted: isLastChunk,
              completedTotalSyncCount: 0,
              successfulTotalSyncCount: 0,
              clusterSyncExceptions: [
                {
                  exceptionType: SyncExceptionTypeProto.MAX_EXECUTION_TIME_EXCEEDED,
                  exceptionMessage:
                    "Synchronization is not completely executed due to exceeding " +
                    `the maximum sync time ${maxSyncDurationMinutes} minutes`,
                },
              ],
            };
            chunkResultsToPersist.push(clusterResult);
            // 已发生异常不再请求, 数据缓存一次结束
            return;
          }

          // 记录当前集群本次chunk内执行开始时间
          clusterLastChunkEndTime[clusterId] = Date.now();

          const syncAccountsResult = await getSyncAccountsWithPartitions(
            clusterId,
            chunkAccounts,
            subLogger,
            scowResourcePlugin,
          );
          const syncAccountsData = syncAccountsResult.syncAccounts;
          subLogger.trace(
            "[Cluster %s] Accounts to execute synchronization in chunk %s: %o",
            clusterId,
            chunkIndex,
            syncAccountsData,
          );

          // 2.如果有授权分区获取失败的账户, 更新数据库到对应失败结果
          // 累积异常数组
          const exceptions: ListAccountUserSynchronizationsResponse_ExceptionDetail[] = [];
          if (syncAccountsResult.partitionsFetchFailedAccounts?.length) {
            subLogger.warn(
              "[Cluster %s] Assigned partitions fetch failed in the accounts: %s , " +
                "the synchronization will skip in them.",
              clusterId,
              syncAccountsResult.partitionsFetchFailedAccounts.join(","),
            );
            const accountsPartitionsException = {
              exceptionType: SyncExceptionTypeProto.ASSIGNED_PARTITIONS_FETCH_FAILED,
              exceptionMessage: syncAccountsResult.partitionsFetchFailedAccounts.join(","),
            };
            exceptions.push(accountsPartitionsException);
          }

          // 如果有没有主管理员的账户, 只在日志中做出提示
          if (syncAccountsResult.abnormalAccountsWithoutOwner?.length) {
            subLogger.warn(
              "Abnormal accounts without owner were found: %s, " +
                "the synchronization will still synchronize them to cluster.",
              syncAccountsResult.abnormalAccountsWithoutOwner.join(","),
            );
          }

          subLogger.trace(
            "[Cluster %s] ***Start Sync in chunk %s with time limit %s seconds***",
            clusterId,
            chunkIndex,
            remainingMillisecondsForCluster / 1000,
          );

          await clusterPlugin
            .callOnOneClient(
              clusterId,
              subLogger,
              clusterClient,
              async (client) => {
                const clusterChunkResult = await asyncClientCall(
                  client.account,
                  "syncAccountUserInfo",
                  {
                    sessionId,
                    syncAccounts: syncAccountsData,
                    timeoutMilliseconds: remainingMillisecondsForCluster,
                  },
                  {
                    metadata: new Metadata(),
                    // 在原本给适配器的执行时间基础上增加 10s 的冗余超时时间，避免因为网络等问题无法按时响应
                    options: { deadline: Date.now() + remainingMillisecondsForCluster + 10 * 1000 },
                  },
                );

                let timeoutException: ListAccountUserSynchronizationsResponse_ExceptionDetail | undefined = undefined;
                // 检查本次chunk内是否在限制时间内已全部执行
                if (clusterChunkResult.completelyExecuted === false) {
                  subLogger.warn(
                    "[Cluster %s] Synchronization not completely executed within time limit %s seconds in chunk %s",
                    clusterId,
                    remainingMillisecondsForCluster / 1000,
                    chunkIndex,
                  );
                  clustersShouldContinue[clusterId] = false;
                  timeoutException = {
                    exceptionType: SyncExceptionTypeProto.MAX_EXECUTION_TIME_EXCEEDED,
                    exceptionMessage:
                      "Synchronization is not completely executed due to exceeding " +
                      `the maximum sync time ${maxSyncDurationMinutes} minutes`,
                  };
                  exceptions.push(timeoutException);
                }

                // 3.如果本次Chunk内在正常执行，但是没有返回值则没有需要同步的数据
                // 保存这个结果到待写入数据库
                if (clusterChunkResult.syncResults.length === 0) {
                  subLogger.trace(
                    "[Cluster: %s] No data need to be synchronized in this chunk: %s.",
                    clusterId,
                    chunkIndex,
                  );
                  const clusterResult: ClusterTotalSyncResultProto = {
                    clusterId,
                    clusterSyncStatus:
                      isLastChunk || clusterChunkResult.completelyExecuted === false
                        ? SyncStatusProto.COMPLETED
                        : SyncStatusProto.RUNNING,
                    executedChunkCount: chunkIndex,
                    isAllChunkExecuted: isLastChunk,
                    completedTotalSyncCount: 0,
                    successfulTotalSyncCount: 0,
                    clusterSyncExceptions: exceptions.length > 0 ? exceptions : [],
                  };
                  chunkResultsToPersist.push(clusterResult);
                }
                // 4.如果本次Chunk内在正常执行，有同步结果的返回数据
                // 保存这个结果到待写入数据库
                if (clusterChunkResult.syncResults.length > 0) {
                  subLogger.trace(
                    "[Cluster: %s] Chunk (index: %s) sync result: %o, completelyExecuted is %s",
                    clusterId,
                    chunkIndex,
                    clusterChunkResult.syncResults,
                    clusterChunkResult.completelyExecuted,
                  );

                  const currentClusterTotalResult: ClusterTotalSyncResultProto = {
                    clusterId,
                    clusterSyncStatus:
                      isLastChunk || clusterChunkResult.completelyExecuted === false
                        ? SyncStatusProto.COMPLETED
                        : SyncStatusProto.RUNNING,
                    executedChunkCount: chunkIndex,
                    isAllChunkExecuted: isLastChunk,
                    completedTotalSyncCount: clusterChunkResult.syncResults.length,
                    successfulTotalSyncCount: clusterChunkResult.syncResults.filter((x) => x.success)?.length,
                    clusterSyncExceptions: exceptions.length > 0 ? exceptions : [],
                    clusterSyncDetails: transformToUpdatedSummaryMap(clusterChunkResult.syncResults, subLogger),
                  };
                  chunkResultsToPersist.push(currentClusterTotalResult);
                }
              },

              // 5.如果本次Chunk发生错误，记录异常信息
              // 保存这个结果到待写入数据库
            )
            .catch(async (e) => {
              subLogger.error(
                "[Cluster: %s] Error occurred during account user synchronization in synchronization " +
                  "chunk: %s, details: %o",
                clusterId,
                chunkIndex,
                e,
              );

              const currentClusterTotalResult: ClusterTotalSyncResultProto = {
                clusterId,
                clusterSyncStatus: isLastChunk ? SyncStatusProto.COMPLETED : SyncStatusProto.RUNNING,
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
              chunkResultsToPersist.push(currentClusterTotalResult);
            });
        }),
      );

      clusterSyncTasks.forEach((result, index) => {
        const clusterId = clusterClients[index][0];
        subLogger.trace(
          "[Cluster: %s] Synchronization chunk %s task settled with status: %s",
          clusterId,
          chunkIndex,
          result.status,
        );
        if (result.status === "fulfilled") return;

        subLogger.error(
          result.reason,
          "[Cluster: %s] Unexpected error occurred while synchronizing chunk: %s",
          clusterId,
          chunkIndex,
        );
        chunkResultsToPersist.push({
          clusterId,
          clusterSyncStatus: isLastChunk ? SyncStatusProto.COMPLETED : SyncStatusProto.RUNNING,
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
        });
      });

      // 一个chunk内记录一次各集群同步情况
      subLogger.info("Current synchronization in chunk %s, %o", chunkIndex, chunkResultsToPersist);

      // 一个chunk内标记一次待保存数据
      await persistSyncRecord(em, syncRecord, { syncDetails: chunkResultsToPersist }, subLogger);

      // 更新分片索引
      startIndex += chunkSize;
      chunkIndex++;
    }
    // ************************************* 对数据进行切片结束 ***********************************************

    // 所有数据处理结束时
    // 更新此次数据同步任务状态为 COMPLETED 到数据库
    const newRecordItems: Partial<AccountUserSyncRecord> = {
      syncStatus: SyncStatus.COMPLETED,
    };

    // 长事务结束前标记待保存数据
    await persistSyncRecord(em, syncRecord, newRecordItems, subLogger);
    // 长事务结束前生成并执行SQL
    await em.flush();
  });
}

/**
 * 映射返回的同步操作结果为SyncDetailsSummaryMap类型
 * @param syncResults
 * @returns SyncDetailsSummaryMap结果
 */
export function transformToUpdatedSummaryMap(
  syncResults: SyncAccountUserInfoResponse_SyncOperationResult[],
  logger: Logger,
): SyncDetailsSummaryProto {
  const summary: SyncDetailsSummaryProto = {};

  syncResults.forEach((sr) => {
    const { syncOperation, success, failureMessage } = sr;

    switch (syncOperation?.$case) {
      case "createAccount":
        {
          summary.createAccount = summary.createAccount || { results: [] };
          summary.createAccount.results.push({
            accountName: syncOperation.createAccount.accountName,
            success,
            failureMessage,
          });
        }
        break;
      case "blockAccount":
        {
          summary.blockAccount = summary.blockAccount || { results: [] };
          summary.blockAccount.results.push({
            accountName: syncOperation.blockAccount.accountName,
            success,
            failureMessage,
          });
        }
        break;
      case "unblockAccount":
        {
          summary.unblockAccount = summary.unblockAccount || { results: [] };
          summary.unblockAccount.results.push({
            accountName: syncOperation.unblockAccount.accountName,
            success,
            failureMessage,
          });
        }
        break;
      case "addUserToAccount":
        {
          summary.addUserToAccount = summary.addUserToAccount || { results: [] };
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
          summary.blockUserInAccount = summary.blockUserInAccount || { results: [] };
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
          summary.unblockUserInAccount = summary.unblockUserInAccount || { results: [] };
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
          summary.removeUserFromAccount = summary.removeUserFromAccount || { results: [] };
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
}

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
  logger: Logger,
): Promise<Loaded<Account, "tenant" | "users" | "users.user">[]> {
  logger.info(
    "Adding pessimistic read locks to 'Account' and 'UserAccount' tables. " +
      "Write operations on these tables may be blocked during the synchronization.",
  );
  // 对 Account 加锁
  const dbAccounts = await em.createQueryBuilder(Account).setLockMode(LockMode.PESSIMISTIC_READ).getResultList();

  // 对 UserAccount 表加锁
  await em.createQueryBuilder(UserAccount).setLockMode(LockMode.PESSIMISTIC_READ).getResultList();

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
}

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
    const client = getSchedulerAdapterClient(cluster.adapterUrl, certificates, {
      timeoutMs: config.ADAPTER_TIMEOUT_SECONDS * 1000,
    });

    if (!client) {
      // 如果创建客户端失败，记录失败的集群 ID，在此次同步操作中跳过该集群操作
      logger.info("Calling actions on non-existing cluster " + clusterId);
      failedExecutedClusterIds.push(clusterId);
    } else {
      adapterClientPool[clusterId] = client;
    }
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
  // 没有主管理员的异常账户
  abnormalAccountsWithoutOwner?: string[];
}

/**
 * 获取账户用户数据中的账户已授权分区
 * @param clusterId 分区对应的集群id
 * @param accounts 当前需要查找已授权分区的账户数据
 * @param logger
 * @param scowResourcePlugin
 * @returns 返回需要执行同步操作的账户数据以及获取已授权分区失败的账户名数组
 */
export async function getSyncAccountsWithPartitions(
  clusterId: string,
  accounts: Loaded<Account, "tenant" | "users" | "users.user">[],
  logger: Logger,
  scowResourcePlugin: ScowResourcePlugin["resource"],
): Promise<GetSyncExecAccountsResponse> {
  let partitionsFetchFailedAccounts: string[] = [];
  const abnormalAccountsWithoutOwner: string[] = [];

  // 只查询状态为在集群下解封的账户授权分区
  const queryAccounts = accounts
    .filter((account) => {
      return account.whitelist?.id || !account.blockedInCluster;
    })
    .map((account) => ({
      accountName: account.accountName,
      tenantName: account.tenant.getProperty("name"),
    }));

  let syncAccounts: SyncAccountInfo[] = [];

  const reply: Record<string, PartitionNames> | undefined = await scowResourcePlugin
    .getAccountsAssignedPartitionsForCluster({
      accountsWithTenants: queryAccounts,
      clusterId,
    })
    .catch((e) => {
      // 因为一个chunk内的账户不一定都是在集群下解封状态
      // 所以获取授权分区失败的账户+仍然只做记录，不取消本次chunk
      partitionsFetchFailedAccounts = queryAccounts.map((a) => a.accountName);
      logger.error(
        "[Cluster: %s] Fetch assigned partitions of [%s] failed, %o",
        clusterId,
        partitionsFetchFailedAccounts.join(","),
        e,
      );
      return undefined;
    });

  logger.trace("[Cluster: %s] Partitions fetched of [%o]", clusterId, reply);

  // 增加兜底处理
  // 如果上述reply正常返回，但是缺少了某些 account 的结果（不包括分区为空的情况 accountA: { partitionNames: [] }）
  // 跳过这些账户并记录为失败未处理，防止传递错误信息封锁账户
  if (reply) {
    const missingAccounts = queryAccounts
      .filter(({ accountName }) => !Object.prototype.hasOwnProperty.call(reply, accountName))
      .map(({ accountName }) => accountName);

    if (missingAccounts.length > 0) {
      partitionsFetchFailedAccounts = missingAccounts;
      logger.error(
        "[Cluster: %s] Assigned partitions response is missing accounts: [%s]",
        clusterId,
        missingAccounts.join(","),
      );
    }
  }

  syncAccounts = accounts
    .filter((account) => {
      const owner = account.users.find((x) => x.role === UserRole.OWNER)?.user.getProperty("userId");

      // 如果不存在主管理员，保留该账户进行同步，只返回不存在主管理员的数组方便后端留存特殊日志
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
        ownerId: account.users.find((x) => x.role === UserRole.OWNER)?.user.getProperty("userId"),
        whitelistId: account.whitelist?.id,
        blockedInCluster: account.blockedInCluster,
        unblockedPartitions: {
          $case: "assignedPartitions",
          assignedPartitions: { partitions: reply?.[account.accountName]?.partitionNames ?? [] },
        },
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
 * @param sessionId 已经保存在数据库中的同步记录
 * @param newUpdateItems 现在想要更新的同步记录
 * @returns persist后的账户用户同步操作记录
 */
export async function persistSyncRecord(
  em: SqlEntityManager<MySqlDriver>,
  originSyncRecord: Loaded<AccountUserSyncRecord>,
  newUpdateItems: Partial<AccountUserSyncRecord>,
  logger: Logger,
): Promise<Loaded<AccountUserSyncRecord>> {
  logger.trace(
    "Update account user sync record from current record %o to new record with items %o",
    originSyncRecord,
    newUpdateItems,
  );

  const getClusterFinalSyncResult = (recordSyncResult: ClusterTotalSyncResultProto): SyncResultProto => {
    const hasException = recordSyncResult.clusterSyncExceptions && recordSyncResult.clusterSyncExceptions.length > 0;
    const hasFailedResult = recordSyncResult.successfulTotalSyncCount < recordSyncResult.completedTotalSyncCount;
    const isFailed = hasException || hasFailedResult;
    return isFailed ? SyncResultProto.FAILED : SyncResultProto.SUCCESS;
  };

  // 合并 syncDetails
  const newSyncDetails: ClusterTotalSyncResultProto[] = newUpdateItems.syncDetails || [];
  const originSyncDetails: ClusterTotalSyncResultProto[] = originSyncRecord.syncDetails || [];

  const originSyncDetailsClusterIds = originSyncDetails.map((s) => s.clusterId);
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
        originSyncDetails.find((s) => s.clusterId === newResult.clusterId) ?? ({} as ClusterTotalSyncResultProto);

      originClusterResult.completedTotalSyncCount += newResult.completedTotalSyncCount;
      originClusterResult.successfulTotalSyncCount += newResult.successfulTotalSyncCount;

      if (newResult.clusterSyncExceptions?.length) {
        originClusterResult.clusterSyncExceptions = originClusterResult.clusterSyncExceptions || [];
        originClusterResult.clusterSyncExceptions.push(...newResult.clusterSyncExceptions);
      }
      if (newResult.clusterSyncDetails) {
        originClusterResult.clusterSyncDetails = updateSyncDetails(
          originClusterResult.clusterSyncDetails || {},
          newResult.clusterSyncDetails,
        );
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

  em.persist(originSyncRecord);

  logger.trace("the new record is %o", originSyncRecord);

  // 如果已经同步结束则发送通知
  if (originSyncRecord.syncStatus === SyncStatus.COMPLETED && originSyncRecord.syncResult) {
    let syncClusterIds: string[] = [];
    let hasException: boolean = false;
    let totalSucceedCount: number = 0;
    let totalFailedCount: number = 0;
    // 如果没有集群同步结果，则发送当前在线集群的异常结果通知
    if (!originSyncRecord.syncDetails?.length) {
      const activatedClusters = await em.find(Cluster, { activationStatus: ClusterActivationStatus.ACTIVATED });
      syncClusterIds = activatedClusters.map((c) => c.clusterId);
      hasException = true;
    } else {
      originSyncRecord.syncDetails.map((clusterResult) => {
        if (clusterResult.clusterSyncExceptions.length > 0) {
          hasException = true;
        }
        syncClusterIds.push(clusterResult.clusterId);
        totalSucceedCount += clusterResult.successfulTotalSyncCount;
        totalFailedCount += clusterResult.completedTotalSyncCount - clusterResult.successfulTotalSyncCount;
      });
    }

    await sendAccountUserSyncMessage(
      em,
      hasException ? MessageStatus.EXCEPTION : MessageStatus.COMPLETED,
      totalSucceedCount,
      totalFailedCount,
      syncClusterIds,
      logger,
    );
  }

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
    const isSyncRunningFound = await em.findOne(
      AccountUserSyncRecord,
      { syncStatus: SyncStatus.RUNNING },
      {
        lockMode: LockMode.PESSIMISTIC_WRITE,
      },
    );
    const validRunningExists = await checkValidRunningSyncRecord(em, logger, isSyncRunningFound);

    if (validRunningExists) {
      throw new ServiceError({
        code: Status.FAILED_PRECONDITION,
        details:
          "Account User Synchronization is running. " +
          `Please wait for its completion before starting the ${taskNameForErrorMessage}.`,
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
    const isSyncRunningFound = await em.findOne(
      AccountUserSyncRecord,
      { syncStatus: SyncStatus.RUNNING },
      {
        lockMode: LockMode.PESSIMISTIC_WRITE,
      },
    );
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
    logger.warn(
      "An abnormal account user synchronization task is found during system start. " + "It will be updated to FAILED.",
    );
    await updateStuckRunningSync(em, logger, runningSyncRecord);
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
  if (runningProcessTime + TIMEOUT_BUFFER_MILLISECONDS > maxSyncDurationMilliseconds) {
    const checkModeMessage = isDuringSystemStarting ? "system error" : "timeout";
    logger.warn(
      "An abnormal account user synchronization task caused by %s is found. It will be updated to FAILED.",
      checkModeMessage,
    );
    await updateStuckRunningSync(em, logger, runningSyncRecord, maxSyncMinutes);
    return false;
  }
  logger.info("The running account user synchronization task is valid.");
  return true;
}

/**
 * 更新异常的正在运行的同步账户用户信息记录
 * @param maxSyncMinutes 用于超时时数据更新，需要传递此数据用于错误记录；不存在则认为是异常原因
 */
export async function updateStuckRunningSync(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  runningSyncRecord: Loaded<AccountUserSyncRecord>,
  maxSyncMinutes?: number,
): Promise<void> {
  logger.info("Starting update abnormal running account user synchronization record.");
  const errorModeMessage = maxSyncMinutes
    ? `exceeding the maximum sync time ${maxSyncMinutes} minutes`
    : "unknown error";
  const exceptionType = maxSyncMinutes
    ? SyncExceptionTypeProto.MAX_EXECUTION_TIME_EXCEEDED
    : SyncExceptionTypeProto.EXCEPTION_UNKNOWN;

  runningSyncRecord.syncResult = SyncResult.FAILED;

  let syncClusterIds: string[] = [];
  let totalSucceedCount: number = 0;
  let totalFailedCount: number = 0;

  if (!runningSyncRecord.syncDetails) {
    // 更新整个同步结果为未执行
    runningSyncRecord.syncStatus = SyncStatus.UNEXECUTED;
    await em.persistAndFlush(runningSyncRecord);

    const activatedClusters = await em.find(Cluster, { activationStatus: ClusterActivationStatus.ACTIVATED });
    syncClusterIds = activatedClusters.map((c) => c.clusterId);
  } else {
    // 更新整个同步结果为结束
    runningSyncRecord.syncStatus = SyncStatus.COMPLETED;
    // 更新同步的各集群 状态/结果/异常
    const updatedClusterResults: ClusterTotalSyncResultProto[] = runningSyncRecord.syncDetails?.map((clusterResult) => {
      syncClusterIds.push(clusterResult.clusterId);
      totalSucceedCount += clusterResult.successfulTotalSyncCount;
      totalFailedCount += clusterResult.completedTotalSyncCount - clusterResult.successfulTotalSyncCount;
      return {
        ...clusterResult,
        clusterSyncStatus: SyncStatusProto.COMPLETED,
        clusterSyncResult: SyncResultProto.FAILED,
        isAllChunkExecuted: true,
        clusterSyncExceptions: [
          {
            exceptionType: exceptionType,
            exceptionMessage: `Synchronization is not completely executed due to ${errorModeMessage}`,
          },
        ],
      };
    });

    await persistSyncRecord(em, runningSyncRecord, { syncDetails: updatedClusterResults }, logger);
    await em.flush();
  }

  logger.info("The abnormal running account user synchronization record is updated to FAILED.");
  // 发送结果异常通知
  await sendAccountUserSyncMessage(
    em,
    MessageStatus.EXCEPTION,
    totalSucceedCount,
    totalFailedCount,
    syncClusterIds,
    logger,
  );
}

export async function sendAccountUserSyncMessage(
  em: SqlEntityManager<MySqlDriver>,
  syncMessageStatus: MessageStatus,
  totalSucceedCount: number,
  totalFailedCount: number,
  syncClusterIds: string[],
  logger: Logger,
): Promise<void> {
  const platformAdminUsers = await em.find(User, { platformRoles: { $like: `%${PlatformRole.PLATFORM_ADMIN}%` } });

  const i18nClusterNameArray: I18nStringType[] = [];
  syncClusterIds.map((clusterId) => {
    const clusterDetails = configClusters[clusterId];
    i18nClusterNameArray.push(clusterDetails.displayName ?? clusterId);
  });
  const syncI18nClusterNames = mergeI18nStrings(i18nClusterNameArray);

  await sendMessage(
    {
      messageType: InternalMessageType.AccountUserSyncResult,
      targetType: TargetType.USER,
      targetIds: platformAdminUsers.map((u) => u.userId),
      metadata: {
        time: new Date().toISOString(),
        messageStatus: syncMessageStatus,
        totalSucceedCount,
        totalFailedCount,
        syncI18nClusterNames,
      },
    },
    logger,
  );
}
