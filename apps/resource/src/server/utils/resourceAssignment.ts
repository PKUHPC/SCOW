import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Logger } from "pino";
import { getScowAccounts } from "src/server/mis-server/tenantAccount";
import { getClusterUtils } from "src/utils/clusterAdapter";

export interface UnassignResult {
  failedBlockedAccounts: string[];
  successfullyBlockedAccounts: string[];
}

export interface AssignResult {
  failedUnblockedAccounts: string[];
  successfullyUnblockedAccounts: string[];
  accountsToProcessInEm: string[];
}

export type UnassignResultType = UnassignResult;
export type AssignResultType = AssignResult;

const ACCOUNT_ASSIGNMENT_PROGRESS_LOG_INTERVAL = 100;

const logAccountAssignmentProgress = (
  logger: Logger,
  action: string,
  completed: number,
  total: number,
  successCount: number,
  failedCount: number,
  startedAt: number,
) => {
  if (total === 0) {
    return;
  }

  if (completed !== total && completed % ACCOUNT_ASSIGNMENT_PROGRESS_LOG_INTERVAL !== 0) {
    return;
  }

  logger.info(
    "%s progress: completed %d/%d accounts, succeeded %d, failed %d, elapsed %dms.",
    action,
    completed,
    total,
    successCount,
    failedCount,
    Date.now() - startedAt,
  );
};

/**
 * 在取消租户授权集群/授权分区 或者移出默认集群/移出默认分区时
 * 对租户下所有账户进行集群下所有分区的封锁/或者某一分区的封锁
 *
 * @param tenantName
 * @param clusterId
 * @param logger
 * @param partitionName 如果不存在，则对集群所有分区取消授权
 * @returns
 */
export async function unAssignTenantAccountsThroughCluster(
  tenantName: string,
  clusterId: string,
  logger: Logger,
  partitionName?: string,
): Promise<UnassignResultType> {
  // 在 scow 下获取租户 tenantName 下的所有账户
  const scowTenantAccounts = await getScowAccounts(tenantName);
  const accountNameList = scowTenantAccounts.results.map((a) => a.accountName);

  // 调用适配器接口, 在集群下封锁这个租户下的所有账户
  const failedBlockedAccounts: string[] = [];
  const successfullyBlockedAccounts: string[] = [];

  if (accountNameList.length === 0) {
    logger.info("No accounts need to be unassigned for tenant %s in cluster %s.", tenantName, clusterId);
    return {
      failedBlockedAccounts,
      successfullyBlockedAccounts,
    };
  }

  const clustersUtil = await getClusterUtils();
  const startedAt = Date.now();
  await clustersUtil.callOnOne(clusterId, logger, async (adapterClient) => {
    let blockedPartitions = partitionName ? [partitionName] : [];

    if (!partitionName) {
      const clusterConfig = await asyncClientCall(adapterClient.config, "getClusterConfig", {});
      // 获取当前集群下所有分区
      blockedPartitions = clusterConfig.partitions.map((p) => p.name);
    }

    logger.info(
      "Start unassigning %d accounts of tenant %s in cluster %s with %d blocked partitions.",
      accountNameList.length,
      tenantName,
      clusterId,
      blockedPartitions.length,
    );

    if (blockedPartitions.length === 0) {
      logger.info("No partitions need to be blocked for tenant %s in cluster %s.", tenantName, clusterId);
      return;
    }

    let completed = 0;
    await Promise.allSettled(
      accountNameList.map(async (accountName) => {
        try {
          // 封锁当前集群下所有分区 或者传递的指定分区
          const result = await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
            accountName,
            blockedPartitions,
          });

          if (result) {
            successfullyBlockedAccounts.push(accountName);
          }
        } catch (e) {
          logger.info(
            "Can not unassign account (accountName : %s) in cluster (ClusterId: %s) with error details: %o",
            accountName,
            clusterId,
            e,
          );
          failedBlockedAccounts.push(accountName);
        } finally {
          completed += 1;
          logAccountAssignmentProgress(
            logger,
            "Unassign tenant accounts through cluster",
            completed,
            accountNameList.length,
            successfullyBlockedAccounts.length,
            failedBlockedAccounts.length,
            startedAt,
          );
        }
      }),
    );
  });

  logger.info(
    "Finished unassigning accounts of tenant %s in cluster %s. Total %d, succeeded %d, failed %d, elapsed %dms.",
    tenantName,
    clusterId,
    accountNameList.length,
    successfullyBlockedAccounts.length,
    failedBlockedAccounts.length,
    Date.now() - startedAt,
  );

  return {
    failedBlockedAccounts,
    successfullyBlockedAccounts,
  };
}

/**
 * 在添加默认授权集群或者添加默认分区时
 * 对租户下状态为解封的账户进行集群下指定分区的封锁
 *
 * 为什么不是对所有分区进行封锁，因为当前slurm版本适配器无法单独区分账户的状态
 * 为了统一适配器逻辑，对于非解封状态的账户，暂时只在资源管理数据库中记录账户的授权分区信息
 * 在实际因为充值或者手动解封时，传递资源管理保存的分区信息，使授权分区数据一致
 *
 * @param tenantName
 * @param clusterId
 * @param partitionName
 * @param existedAccountNames
 * @param logger
 * @returns
 */
export async function assignTenantAccountsPartitionThroughCluster(
  tenantName: string,
  clusterId: string,
  partitionName: string,
  existedAccountNames: string[],
  logger: Logger,
): Promise<AssignResult> {
  // 在 scow 下获取租户 tenantName 下的所有账户
  const scowTenantAccounts = await getScowAccounts(tenantName);
  const unblockedAccountNameList = scowTenantAccounts.results.filter((x) => !x.blocked).map((x) => x.accountName);
  const accountNameList = scowTenantAccounts.results.map((a) => a.accountName);

  // 获取本次需要更新的账户列表
  const existedAccountSet = new Set(existedAccountNames);
  const unblockedAccountsToProcess = unblockedAccountNameList.filter(
    (accountName) => !existedAccountSet.has(accountName),
  );

  const failedUnblockedAccounts: string[] = [];
  const successfullyUnblockedAccounts: string[] = [];
  // 如果在集群下解封状态的账户存在
  // 调用适配器接口
  // 确保正常状态的账户在集群的此分区下同时解封

  // 为了减少操作处理时间，没有对所有账户进行此操作
  // scow在账户解封时同时还会再次传输在scow保存的分区信息，此时会处理未授权和授权的分区信息
  if (unblockedAccountsToProcess.length > 0) {
    const clustersUtil = await getClusterUtils();
    const startedAt = Date.now();
    await clustersUtil.callOnOne(clusterId, logger, async (adapterClient) => {
      logger.info(
        "Start assigning partition %s of cluster %s to %d unblocked accounts of tenant %s.",
        partitionName,
        clusterId,
        unblockedAccountsToProcess.length,
        tenantName,
      );

      let completed = 0;
      await Promise.allSettled(
        unblockedAccountsToProcess.map(async (accountName) => {
          try {
            const result = await asyncClientCall(adapterClient.account, "unblockAccountWithPartitions", {
              accountName,
              unblockedPartitions: [partitionName],
            });

            if (result) {
              successfullyUnblockedAccounts.push(accountName);
            }
          } catch (e) {
            logger.info(
              "Can not assign account (accountName : %s) in cluster (ClusterId: %s) with error details: %s",
              accountName,
              clusterId,
              e,
            );
            failedUnblockedAccounts.push(accountName);
          } finally {
            completed += 1;
            logAccountAssignmentProgress(
              logger,
              "Assign tenant accounts partition through cluster",
              completed,
              unblockedAccountsToProcess.length,
              successfullyUnblockedAccounts.length,
              failedUnblockedAccounts.length,
              startedAt,
            );
          }
        }),
      );
    });

    logger.info(
      "Finished assigning partition %s of cluster %s to unblocked accounts of tenant %s. " +
        "Total %d, succeeded %d, failed %d, elapsed %dms.",
      partitionName,
      clusterId,
      tenantName,
      unblockedAccountsToProcess.length,
      successfullyUnblockedAccounts.length,
      failedUnblockedAccounts.length,
      Date.now() - startedAt,
    );
  }

  const failedUnblockedAccountSet = new Set(failedUnblockedAccounts);
  const accountsToProcessInEm = accountNameList
    .filter((accountName) => !existedAccountSet.has(accountName))
    .filter((accountName) => !failedUnblockedAccountSet.has(accountName));

  return {
    failedUnblockedAccounts,
    successfullyUnblockedAccounts,
    accountsToProcessInEm,
  };
}
