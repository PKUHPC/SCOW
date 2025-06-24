import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ensureResourceManagementFeatureAvailable } from "@scow/lib-server";
import { TRPCError } from "@trpc/server";
import { AccountClusterRule } from "src/server/entities/AccountClusterRule";
import { AccountPartitionRule } from "src/server/entities/AccountPartitionRule";
import { callHook } from "src/server/hookClient";
import { getScowActivatedClusters, getScowClusterConfigs } from "src/server/mis-server/cluster";
import { checkSyncAccountUserRunning } from "src/server/mis-server/synchronization";
import { getScowAccounts } from "src/server/mis-server/tenantAccount";
import { authProcedure } from "src/server/trpc/procedure/base";
import { AccountUserSyncRunningError, isResourceAdmin, 
  NoAvailableClustersError, UserForbiddenError } from "src/utils/auth/utils";
import { getClusterUtils } from "src/utils/clusterAdapter";
import { forkEntityManager } from "src/utils/getOrm";
import { logger } from "src/utils/logger";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { mock, MOCK_ALL_ACC_ASSIGNED_PARTITIONS,
  MOCK_ALL_ACCT_ASSIGNED_INFO } from "../mock";
import { AllAssignedInfoSchema } from "./tenantClusterPartitions";

export const AssignedPartitionSchema = z.object({
  clusterId: z.string(),
  partition: z.string(),
});

export const allAccountsAssignedClustersPartitions = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/allAccountsAssignedClustersPartitions",
      tags: ["AccountClustersPartitions"],
      summary: "获取租户下所有账户已授权集群及分区的详细列表",
    },
  })
  .input(
    z.object({
      tenantName: z.string(),
    }),
  )
  .output(z.array(AllAssignedInfoSchema))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {

        const { tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        // 检查现在是否有可用集群
        const currentClusters = await getScowActivatedClusters();
        if (!currentClusters || currentClusters.length === 0) {
          throw new NoAvailableClustersError();
        }
        const currentClusterIds = currentClusters.map((c) => c.id);

        const resultMap: Record<string , AllAssignedInfoSchema> = {};

        // 获取 scow 中 tenantName 下所有账户
        const allTenantAccounts = await getScowAccounts(tenantName);
        allTenantAccounts.results.forEach((account) => {
          resultMap[account.accountName] = {
            accountName: account.accountName,
            tenantName: account.tenantName,
            assignedInfo: {
              assignedClusters: [],
              assignedClustersCount: 0,
              assignedPartitions: [],
              assignedPartitionsCount: 0,
            },
          };
        });

        const em = await forkEntityManager();
        // 获取已授权集群信息
        const qbClusters = em.createQueryBuilder(AccountClusterRule, "acr");
        const accountAssignedClustersInfo = await qbClusters
          .select(["accountName", "tenantName", "clusterId"])
          .where({ "clusterId":  { $in: currentClusterIds } })
          .execute();

        accountAssignedClustersInfo.forEach((item) => {
          // 只获取与 从scow获取的租户已授权集群信息
          if (resultMap[item.accountName]) {
            resultMap[item.accountName].assignedInfo.assignedClusters.push(item.clusterId);
          }
        });

        // 获取已授权分区信息
        const qbPartitions = em.createQueryBuilder(AccountPartitionRule, "apr");
        const accountAssignedPartitionsInfo = await qbPartitions
          .select(["tenantName", "accountName", "partition", "clusterId"])
          .where({ "clusterId":  { $in: currentClusterIds } })
          .execute();

        accountAssignedPartitionsInfo.forEach((item) => {
          // 只获取与 从scow获取的租户已授权分区信息
          if (resultMap[item.accountName]) {
            resultMap[item.accountName].assignedInfo.assignedPartitions.push({
              clusterId: item.clusterId,
              partition: item.partition,
            });
          }
        });


        const assignedResult = Object.values(resultMap).map((item) => ({
          accountName: item.accountName,
          tenantName: item.tenantName,
          assignedInfo: {
            assignedClusters: item.assignedInfo.assignedClusters,
            assignedClustersCount: item.assignedInfo.assignedClusters.length,
            assignedPartitions: item.assignedInfo.assignedPartitions,
            assignedPartitionsCount: item.assignedInfo.assignedPartitions.length,
          },
        }));

        return assignedResult;
      },

      async () => {

        return MOCK_ALL_ACCT_ASSIGNED_INFO;
      },
    );
  });


export const assignAccountCluster = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/assignAccountCluster",
      tags: ["AccountClustersPartitions"],
      summary: "授权账户集群",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    accountName: z.string(),
    clusterId: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, accountName, clusterId } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const configClusters = await getScowClusterConfigs();
    if (configClusters.clusterConfigs.length === 0) {
      logger.info("Can not find cluster config files.");
      throw new NoAvailableClustersError;
    }

    // 检查当前是否有正在进行的账户用户同步任务
    const checkRunning = await checkSyncAccountUserRunning();
    if (checkRunning.isRunning) {
      throw new AccountUserSyncRunningError();
    }
    
    const em = await forkEntityManager();

    const accountCluster = await em.findOne(AccountClusterRule, { tenantName, accountName, clusterId });

    if (accountCluster) {
      logger.info("The cluster %s has already been assigned to the tenant %s", clusterId, tenantName);
      return;
    }

    const newAccountCluster = new AccountClusterRule({
      tenantName,
      accountName,
      clusterId,
    });
    await em.persistAndFlush(newAccountCluster);

    await callHook("accountAssignedToClusters", { accountName, tenantName, clusterIds: [clusterId]}, logger);

  });

export const unAssignAccountCluster = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/unassignAccountCluster",
      tags: ["AccountPartitions"],
      summary: "取消授权账户集群",
    },
  })
  .input(z.object({
    accountName: z.string(),
    tenantName: z.string(),
    clusterId: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { accountName, tenantName, clusterId } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    // 检查现在是否有可用集群
    const currentClusters = await getScowActivatedClusters();
    if (!currentClusters || currentClusters.length === 0) {
      throw new NoAvailableClustersError();
    }
    const currentClusterIds = currentClusters.map((c) => c.id);
    if (!currentClusterIds.includes(clusterId)) {
      throw new TRPCError({
        message: `Can not find cluster ${clusterId} in current activated clusters.
             Please refresh the page and try again later`,
        code: "NOT_FOUND",
      });
    }

    // 检查当前是否有正在进行的账户用户同步任务
    const checkRunning = await checkSyncAccountUserRunning();
    if (checkRunning.isRunning) {
      throw new AccountUserSyncRunningError();
    }
    

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const accountCluster = await em.findOne(AccountClusterRule, {
        accountName, tenantName, clusterId });

      if (!accountCluster) {
        logger.info(`The account ${accountName} of tenant ${tenantName}
              has already been unassigned from cluster: ${clusterId}`);
        return;
      }

      // 确保正常账户在集群的所有分区已封锁
      const accountInfo = await getScowAccounts(tenantName, accountName);
      const clustersUtil = await getClusterUtils();
      if (!accountInfo.results[0].blocked) {

        await clustersUtil.callOnOne(
          clusterId,
          logger,
          async (adapterClient) => {

            const clusterConfig = await asyncClientCall(adapterClient.config, "getClusterConfig", {});
            // 1.获取当前集群下所有分区
            const partitionNames = clusterConfig.partitions.map((p) => p.name);

            // 2.封锁当前集群下所有分区
            if (partitionNames.length > 0) {
              await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
                accountName,
                blockedPartitions:  partitionNames,
              });
            }
          },
        ).catch((e) => {
          logger.info("Block account %s in cluster (clusterId: %s) failed with error details: %s",
            accountName, clusterId, e);
          throw new TRPCError({
            message: `Can not block the unblocked account ${accountName} in cluster (ClusterId: ${clusterId}).
                 Please confirm the adapter version and try again later`,
            code: "CONFLICT",
          });
        });
      }

      const removedAccountPartitions = await em.find(AccountPartitionRule, {
        accountName, tenantName, clusterId });

      // 移除在该集群的已授权信息, 移除该集群下分区的已授权信息
      em.remove([accountCluster, ...removedAccountPartitions]);

      await em.flush();

      await callHook("accountUnassignedFromCluster", { accountName, tenantName, clusterId }, logger);
    });


  });

export const assignAccountPartition = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/assinAccountPartition",
      tags: ["AccountClustersPartitions"],
      summary: "为账户授权分区",
    },
  })
  .input(z.object({
    accountName: z.string(),
    tenantName: z.string(),
    clusterId: z.string(),
    partition: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { accountName, tenantName, clusterId, partition } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    // 检查现在是否有可用集群
    const currentClusters = await getScowActivatedClusters();
    if (!currentClusters || currentClusters.length === 0) {
      throw new NoAvailableClustersError();
    }
    const currentClusterIds = currentClusters.map((c) => c.id);
    if (!currentClusterIds.includes(clusterId)) {
      throw new TRPCError({
        message: `Can not find cluster ${clusterId} in current activated clusters.
          Please refresh the page and try again later`,
        code: "NOT_FOUND",
      });
    }

    // 检查当前是否有正在进行的账户用户同步任务
    const checkRunning = await checkSyncAccountUserRunning();
    if (checkRunning.isRunning) {
      throw new AccountUserSyncRunningError();
    }
    
    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const accountPartition = await em.findOne(AccountPartitionRule, {
        accountName, tenantName, clusterId, partition });

      if (accountPartition) {
        logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already been assigned to Account: ${accountName}`);
        return;
      }

      // 确保正常账户在集群的此分区下同时解封
      const accountInfo = await getScowAccounts(tenantName, accountName);
      const clustersUtil = await getClusterUtils();
      if (!accountInfo.results[0].blocked) {
        await clustersUtil.callOnOne(
          clusterId,

          logger,
          async (adapterClient) => {
            // 检查当前适配器是否具有资源管理可选功能接口，同时判断当前适配器版本
            await ensureResourceManagementFeatureAvailable(adapterClient, logger);
            await asyncClientCall(adapterClient.account, "unblockAccountWithPartitions", {
              accountName,
              unblockedPartitions: [ partition ],
            });
          },
        ).catch((e) => {
          logger.info(
            "Unblock account %s in partition (clusterId: %s, partitionName: %s) failed with error details: %s",
            accountName, clusterId, partition, e);
          throw new TRPCError({
            message:
            `Can not unblock the account ${accountName} in partition
             (ClusterId: ${clusterId}, Name: ${partition}).
              Please confirm the adapter version and try again later`,
            code: "CONFLICT",
          });
        });
      }

      const newAccountPartition = new AccountPartitionRule({
        accountName,
        tenantName,
        clusterId,
        partition,
      });
      await em.persistAndFlush(newAccountPartition);

    });

  });


export const unAssignAccountPartition = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/unassignAccountPartition",
      tags: ["AccountPartitions"],
      summary: "取消授权账户可用分区",
    },
  })
  .input(z.object({
    accountName: z.string(),
    tenantName: z.string(),
    clusterId: z.string(),
    partition: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { accountName, tenantName, clusterId, partition } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }
    // 检查现在是否有可用集群
    const currentClusters = await getScowActivatedClusters();
    if (!currentClusters || currentClusters.length === 0) {
      throw new NoAvailableClustersError();
    }
    const currentClusterIds = currentClusters.map((c) => c.id);
    if (!currentClusterIds.includes(clusterId)) {
      throw new TRPCError({
        message: `Can not find cluster ${clusterId} in current activated clusters.
          Please confirm the adapter version and try again later`,
        code: "NOT_FOUND",
      });
    }

    // 检查当前是否有正在进行的账户用户同步任务
    const checkRunning = await checkSyncAccountUserRunning();
    if (checkRunning.isRunning) {
      throw new AccountUserSyncRunningError();
    }
    

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const accountPartition = await em.findOne(AccountPartitionRule, {
        accountName, tenantName, clusterId, partition });

      if (!accountPartition) {
        logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already been unassigned from Account: ${accountName}`);
        return;
      }

      // 确保正常账户在集群的此分区已封锁
      const accountInfo = await getScowAccounts(tenantName, accountName);
      const clustersUtil = await getClusterUtils();
      if (!accountInfo.results[0].blocked) {
        await clustersUtil.callOnOne(
          clusterId,
          logger,
          async (adapterClient) => {

            await ensureResourceManagementFeatureAvailable(adapterClient, logger);
            await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
              accountName,
              blockedPartitions: [ partition ],
            });
          },
        ).catch((e) => {
          logger.info("Block account %s in partition (clusterId: %s, partitionName: %s) failed with error details: %o",
            accountName, clusterId, partition, e);
          throw new TRPCError({
            message:
             `Can not block the account ${accountName} in partition
              (ClusterId: ${clusterId}, Name: ${partition}).
              Please confirm the adapter version and try again later`,
            code: "CONFLICT",
          });
        });
      }

      em.remove(accountPartition);

      await em.flush();
    });

  });

export const accountAssignedPartitions = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountPartitions",
      tags: ["AccountClustersPartitions"],
      summary: "获取账户已授权分区列表",
    },
  })
  .input(z.object({
    accountName: z.string(),
    tenantName: z.string(),
  }))
  .output(z.object({
    accountName: z.string(),
    tenantName: z.string(),
    assignedPartitions: z.array(AssignedPartitionSchema),
    assignedTotalCount: z.number(),
  }))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {
        const { accountName, tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(AccountPartitionRule,
          { accountName, tenantName },
        );

        return {
          accountName,
          tenantName: tenantName,
          assignedPartitions: res.map((item) => ({
            clusterId: item.clusterId,
            partition: item.partition,
          })),
          assignedTotalCount: count,
        };
      },
      async () => {
        return MOCK_ALL_ACC_ASSIGNED_PARTITIONS as any;
      },
    );

  });

export const accountAssignedClusters = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountAssignedClusters",
      tags: ["AccountClustersPartitions"],
      summary: "获取账户已授权集群列表",
    },
  })
  .input(z.object({
    accountName: z.string(),
    tenantName: z.string(),
  }))
  .output(z.object({
    accountName: z.string(),
    tenantName: z.string(),
    assignedClusters: z.array(z.string()),
    assignedTotalCount: z.number(),
  }))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {
        const { accountName, tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(AccountClusterRule,
          { accountName, tenantName },
        );

        return {
          accountName,
          tenantName,
          assignedClusters: res.map((x) => (x.clusterId)),
          assignedTotalCount: count,
        };
      },
      async () => {
        return MOCK_ALL_ACC_ASSIGNED_PARTITIONS as any;
      },
    );

  });
