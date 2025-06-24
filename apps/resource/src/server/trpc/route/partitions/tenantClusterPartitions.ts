import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ensureResourceManagementFeatureAvailable } from "@scow/lib-server";
import { TRPCError } from "@trpc/server";
import { AccountClusterRule } from "src/server/entities/AccountClusterRule";
import { AccountPartitionRule } from "src/server/entities/AccountPartitionRule";
import { TenantClusterRule } from "src/server/entities/TenantClusterRule";
import { TenantPartitionRule } from "src/server/entities/TenantPartitionRule";
import { getScowActivatedClusters, getScowClusterConfigs } from "src/server/mis-server/cluster";
import { checkSyncAccountUserRunning } from "src/server/mis-server/synchronization";
import { getScowAccounts, getScowTenants } from "src/server/mis-server/tenantAccount";
import { authProcedure } from "src/server/trpc/procedure/base";
import { AccountUserSyncRunningError, isResourceAdmin, 
  NoAvailableClustersError, UserForbiddenError } from "src/utils/auth/utils";
import { getClusterUtils } from "src/utils/clusterAdapter";
import { forkEntityManager } from "src/utils/getOrm";
import { logger } from "src/utils/logger";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { mock,MOCK_ALL_TEN_ASSIGNED_CLUSTERS,MOCK_ALL_TEN_ASSIGNED_INFO,MOCK_ALL_TEN_ASSIGNED_PARTITIONS,
  MOCK_TENANT_ACCOUNT_DEFAULT_CLUSTERS } from "../mock";

export const AssignedPCountsSchema = z.object({
  assignedName: z.string(),
  assignedPCount: z.number(),
});

export type AssignedPCounts = z.infer<typeof AssignedPCountsSchema>;


export const AssignedPartitionSchema = z.object({
  clusterId: z.string(),
  partition: z.string(),
});
export type AssignedPartitionSchema = z.infer<typeof AssignedPCountsSchema>;

export const AssignedClustersPartitionsSchema = z.object({
  assignedClusters: z.array(z.string()),
  assignedClustersCount: z.number(),
  assignedPartitions: z.array(AssignedPartitionSchema),
  assignedPartitionsCount: z.number(),
});
export type AssignedClustersPartitionsSchema = z.infer<typeof AssignedClustersPartitionsSchema>;

export const AllAssignedInfoSchema = z.object({
  tenantName: z.string(),
  accountName: z.optional(z.string()),
  assignedInfo: AssignedClustersPartitionsSchema,
});
export type AllAssignedInfoSchema = z.infer<typeof AllAssignedInfoSchema>;

export const allTenantAssignedClustersPartitions = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/allTenantAssignedClustersPartitions",
      tags: ["TenantClusterPartitions"],
      summary: "获取所有租户已授权集群及分区的详细列表",
    },
  })
  .input(z.void())
  .output(z.array(AllAssignedInfoSchema))
  .query(async ({ ctx: { user } }) => {

    return mock(
      async () => {
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

        // 获取 scow 中所有租户
        const allTenants = await getScowTenants();
        allTenants.names.forEach((name) => {
          resultMap[name] = {
            tenantName: name,
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
        const qbClusters = em.createQueryBuilder(TenantClusterRule, "tcr");
        const tenantAssignedClustersInfo = await qbClusters
          .select(["tenantName", "clusterId"])
          .where({ "clusterId":  { $in: currentClusterIds } })
          .execute();

        tenantAssignedClustersInfo.forEach((item) => {
          // 只获取与 从scow获取的租户已授权集群信息
          if (resultMap[item.tenantName]) {
            resultMap[item.tenantName].assignedInfo.assignedClusters.push(item.clusterId);
          }
        });

        // 获取已授权分区信息
        const qbPartitions = em.createQueryBuilder(TenantPartitionRule, "tpr");
        const tenantAssignedPartitionsInfo = await qbPartitions
          .select(["tenantName", "partition", "clusterId"])
          .where({ "clusterId":  { $in: currentClusterIds } })
          // .groupBy("tenantName")
          .execute();

        tenantAssignedPartitionsInfo.forEach((item) => {
          // 只获取与 从scow获取的租户已授权分区信息
          if (resultMap[item.tenantName]) {
            resultMap[item.tenantName].assignedInfo.assignedPartitions.push({
              clusterId: item.clusterId,
              partition: item.partition,
            });
          }
        });


        const assignedResult = Object.values(resultMap).map((item) => ({
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

        return MOCK_ALL_TEN_ASSIGNED_INFO;
      },
    );
  });


export const assignTenantCluster = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/assignTenantCluster",
      tags: ["TenantClustersPartitions"],
      summary: "授权租户集群",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const configClusters = await getScowClusterConfigs();
    if (configClusters.clusterConfigs.length === 0) {
      logger.info("Can not find cluster config files.");
      throw new NoAvailableClustersError;
    }

    const em = await forkEntityManager();

    const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

    if (tenantCluster) {
      logger.info("The cluster %s has already been assigned to the tenant %s", clusterId, tenantName);
      return;
    }

    return await em.transactional(async (em) => {

      const newTenantCluster = new TenantClusterRule({
        tenantName,
        clusterId,
        isAccountDefaultCluster: false,
      });
      await em.persistAndFlush(newTenantCluster);

    });

  });

export const unAssignTenantCluster = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/unassignTenantCluster",
      tags: ["TenantClustersPartitions"],
      summary: "取消授权租户集群",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

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

    const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

    if (!tenantCluster) {
      logger.info(`The cluster ${clusterId} has already been unassigned from Tenant: ${tenantName}`);
      return;
    }

    // 在 scow 下获取租户 tenantName 下的所有账户
    const scowTenantAccounts = await getScowAccounts(tenantName);
    const accountNameList = scowTenantAccounts.results.map((a) => a.accountName);

    // 调用适配器接口, 在集群下封锁这个租户下的所有账户
    const failedBlockedAccounts: string[] = [];
    const successfullyBlockedAccounts: string[] = [];

    const clustersUtil = await getClusterUtils();
    await clustersUtil.callOnOne(
      clusterId,
      logger,
      async (adapterClient) => {
        await Promise.allSettled(accountNameList.map(async (accountName) => {
          try {

            const clusterConfig = await asyncClientCall(adapterClient.config, "getClusterConfig", {});
            // 1.获取当前集群下所有分区
            const partitionNames = clusterConfig.partitions.map((p) => p.name);

            // 2.封锁当前集群下所有分区
            if (partitionNames.length > 0) {
              const result = await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
                accountName,
                blockedPartitions:  partitionNames,
              });

              if (result) {
                successfullyBlockedAccounts.push(accountName);
              }
            }
          } catch (e) {
            logger.info("Can not unassign account (accountName : %s) in cluster (ClusterId: %s) with error details: %s",
              accountName, clusterId, e);
            failedBlockedAccounts.push(accountName);
          };
        }));
      },
    );

    // 如果取消授权成功的账户数据存在
    if (successfullyBlockedAccounts.length > 0) {
    // 移除账户集群授权数据，移除账户分区授权数据
      const removedAccountClusters = await em.find(AccountClusterRule, {
        accountName: { $in: successfullyBlockedAccounts }, clusterId });
      const removedAccountPartitions = await em.find(AccountPartitionRule, {
        accountName: { $in: successfullyBlockedAccounts }, clusterId });
      em.remove([...removedAccountClusters, ...removedAccountPartitions]);

      // 取消该集群的默认账户授权集群，取消该集群下分区的默认账户授权分区
      tenantCluster.isAccountDefaultCluster = false;
      const tenantClusterPartitions = await em.find(TenantPartitionRule, { tenantName, clusterId });
      tenantClusterPartitions.forEach((tp) => (tp.isAccountDefaultPartition = false));
    };

    // 如果取消授权失败的账户数据存在
    if (failedBlockedAccounts.length > 0) {
    // 若上述等待移除的数据存在，则同步到数据库
      await em.flush();

      logger.info(
        `Unassign tenant ${tenantName} from cluster (ClusterId: ${clusterId}) failed.`
        + ` Accounts ${failedBlockedAccounts.toString()} were failed to be unassigned,`
        + ` while ${successfullyBlockedAccounts.toString()} were successfully unassigned.`,
      );
      throw new TRPCError({
        message:
        `Unassign tenant ${tenantName} from cluster (ClusterId: ${clusterId}) failed.`
        + ` Accounts ${failedBlockedAccounts.toString()} were failed to be unassigned,`,
        code: "CONFLICT",
      });
    }

    // 如果没有取消授权失败的账户数据，则移除租户集群授权数据，移除租户授权分区数据
    const removedTenantClusterPartitions = await em.find(TenantPartitionRule, { tenantName, clusterId });
    em.remove([tenantCluster, ...removedTenantClusterPartitions]);
    await em.flush();

  });



export const assignTenantPartition = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/assignTenantPartition",
      tags: ["TenantClustersPartitions"],
      summary: "授权租户分区",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
    partition: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId, partition } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const tenantPartition = await em.findOne(TenantPartitionRule, { tenantName, clusterId, partition });

      if (tenantPartition) {
        logger.info("The partition %s of cluster (ClusterId: %s) has already been assigned to the tenant %s",
          partition, clusterId, tenantName);
        return;
      }

      const newTenantPartition = new TenantPartitionRule({
        tenantName,
        partition,
        clusterId,
        isAccountDefaultPartition: false,
      });
      await em.persistAndFlush(newTenantPartition);

    });

  });


export const unAssignTenantPartition = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/unassignTenantPartition",
      tags: ["TenantClustersPartitions"],
      summary: "取消授权租户分区",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
    partition: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId, partition } = input;

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

    const tenantPartition = await em.findOne(TenantPartitionRule, { tenantName, clusterId, partition });

    if (!tenantPartition) {
      logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
          has already been unassigned from Tenant: ${tenantName}`);
      return;
    }

    // 在 scow 下获取租户 tenantName 下的所有账户
    const scowTenantAccounts = await getScowAccounts(tenantName);
    const accountNameList = scowTenantAccounts.results.map((a) => a.accountName);

    // 调用适配器接口, 在集群下封锁这个租户下的所有账户
    const failedBlockedAccounts: string[] = [];
    const successfullyBlockedAccounts: string[] = [];

    const clustersUtil = await getClusterUtils();
    await clustersUtil.callOnOne(
      clusterId,
      logger,
      async (adapterClient) => {
        await Promise.allSettled(accountNameList.map(async (accountName) => {
          try {
            // 指定分区下封锁
            // 检查当前适配器是否具有资源管理可选功能接口，同时判断当前适配器版本
            await ensureResourceManagementFeatureAvailable(adapterClient, logger);
            const result = await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
              accountName,
              blockedPartitions: [partition],
            });
            if (result) {
              successfullyBlockedAccounts.push(accountName);
            }
          } catch (e) {
            logger.info("Can not unassign account (accountName : %s) in cluster (ClusterId: %s) with error details: %s",
              accountName, clusterId, e);
            failedBlockedAccounts.push(accountName);
          };
        }));
      },
    );

    // 如果取消授权成功的账户数据存在
    if (successfullyBlockedAccounts.length > 0) {
      // 移除账户分区授权数据
      const removedAccountPartitions = await em.find(AccountPartitionRule, {
        accountName: { $in: successfullyBlockedAccounts }, partition, clusterId });
      em.remove([...removedAccountPartitions]);

      // 取消该集群的默认账户授权集群，取消该集群下分区的默认账户授权分区
      tenantPartition.isAccountDefaultPartition = false;
    };

    // 如果取消授权失败的账户数据存在
    if (failedBlockedAccounts.length > 0) {
      // 若上述等待移除的数据存在，则同步到数据库
      await em.flush();

      logger.info(
        `Unassign tenant ${tenantName} from partition ${partition} of cluster (ClusterId: ${clusterId}) failed.`
          + ` Accounts ${failedBlockedAccounts.toString()} were failed to be unassigned,`
          + ` while ${successfullyBlockedAccounts.toString()} were successfully unassigned.`);

      throw new TRPCError({
        message:
          `Unassign tenant ${tenantName} from partition ${partition} of cluster (ClusterId: ${clusterId}) failed.`
          + ` Accounts ${failedBlockedAccounts.toString()} were failed to be unassigned.`,
        code: "CONFLICT",
      });
    }

    // 如果没有取消授权失败的账户数据，则移除租户集群授权数据，移除租户授权分区数据
    const removedTenantClusterPartitions = await em.find(TenantPartitionRule, { tenantName, clusterId, partition });
    em.remove([...removedTenantClusterPartitions]);
    await em.flush();

  });


export const accountDefaultClusters = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountDefaultClusters",
      tags: ["TenantClustersPartitions"],
      summary: "获取租户下账户默认授权集群",
    },
  })
  .input(z.object({
    tenantName: z.string(),
  }))
  .output(z.object({
    tenantName: z.string(),
    assignedClusters: z.array(z.string()),
    assignedTotalCount: z.number(),
  }))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {
        const { tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(TenantClusterRule,
          { tenantName, isAccountDefaultCluster: true },
        );

        return {
          tenantName,
          assignedTotalCount: count,
          assignedClusters: res.map((item) => (item.clusterId)),
        };
      },
      async () => {
        return MOCK_TENANT_ACCOUNT_DEFAULT_CLUSTERS;
      },
    );
  });

export const accountDefaultPartitions = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountDefaultPartitions",
      tags: ["TenantClustersPartitions"],
      summary: "获取租户下账户默认授权分区",
    },
  })
  .input(z.object({
    tenantName: z.string(),
  }))
  .output(z.object({
    tenantName: z.string(),
    assignedPartitions: z.array(AssignedPartitionSchema),
    assignedTotalCount: z.number(),
  }))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {
        const { tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(TenantPartitionRule,
          { tenantName, isAccountDefaultPartition: true },
        );

        return {
          tenantName,
          assignedTotalCount: count,
          assignedPartitions: res.map((item) => ({
            clusterId: item.clusterId,
            partition: item.partition,
          })),
        };
      },
      async () => {
        return MOCK_ALL_TEN_ASSIGNED_PARTITIONS;
      },
    );
  });


export const addToAccountDefaultPartitions = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/addToAccountDefaultPartitions",
      tags: ["TenantClustersPartitions"],
      summary: "添加到租户下的账户默认授权分区",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
    partition: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId, partition } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

      if (!tenantCluster) {
        throw new TRPCError({
          message: `The cluster (ClusterId: ${clusterId})
           has not been assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      if (!tenantCluster.isAccountDefaultCluster) {
        throw new TRPCError({
          message: `The cluster (ClusterId: ${clusterId})
           is not the default account clusters assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      const tenantPartition = await em.findOne(TenantPartitionRule, { tenantName, clusterId, partition });

      if (!tenantPartition) {
        throw new TRPCError({
          message: `The partition (ClusterId: ${clusterId}, Name: ${partition})
           has not been assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      if (tenantPartition.isAccountDefaultPartition) {
        logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already been in the account default partitions of Tenant: ${tenantName}`);
        return;
      }

      tenantPartition.isAccountDefaultPartition = true;
      await em.persistAndFlush(tenantPartition);

    });

  });

export const removeFromAccountDefaultPartitions = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/removeFromAccountDefaultPartitions",
      tags: ["TenantClustersPartitions"],
      summary: "从租户下账户默认授权分区中移出",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
    partition: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId, partition } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const tenantPartition = await em.findOne(TenantPartitionRule, { tenantName, clusterId, partition });

      if (!tenantPartition) {
        throw new TRPCError({
          message: `The partition (ClusterId: ${clusterId}, Name: ${partition})
           has not been assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      if (!tenantPartition.isAccountDefaultPartition) {
        logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already removed from the account default partitions of Tenant: ${tenantName}`);
        return;
      }

      tenantPartition.isAccountDefaultPartition = false;
      await em.persistAndFlush(tenantPartition);

    });

  });


export const addToAccountDefaultClusters = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/addToAccountDefaultClusters",
      tags: ["TenantClustersPartitions"],
      summary: "添加到租户下的账户默认授权集群",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

      if (!tenantCluster) {
        throw new TRPCError({
          message: `The cluster (ClusterId: ${clusterId}) has not been assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      if (tenantCluster.isAccountDefaultCluster) {
        logger.info(`The cluster (ClusterId: ${clusterId})
           has already been in the account default partitions of Tenant: ${tenantName}`);
        return;
      }

      tenantCluster.isAccountDefaultCluster = true;
      await em.persistAndFlush(tenantCluster);

    });

  });

export const removeFromAccountDefaultClusters = authProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/removeFromAccountDefaultClusters",
      tags: ["TenantClustersPartitions"],
      summary: "从租户下账户默认授权集群中移出",
    },
  })
  .input(z.object({
    tenantName: z.string(),
    clusterId: z.string(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

    if (!isResourceAdmin(user)) {
      throw new UserForbiddenError(user.identityId);
    }

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

      if (!tenantCluster) {
        throw new TRPCError({
          message: `The partition (ClusterId: ${clusterId}) has not been assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      if (!tenantCluster.isAccountDefaultCluster) {
        logger.info(`The partition (ClusterId: ${clusterId})
           has already removed from the account default partitions of Tenant: ${tenantName}`);
        return;
      }

      const relatedAccountDefaultPartitions = await em.find(TenantPartitionRule, { tenantName, clusterId });
      relatedAccountDefaultPartitions.forEach((partition) => {
        partition.isAccountDefaultPartition = false;
      });
      em.persist(relatedAccountDefaultPartitions);

      tenantCluster.isAccountDefaultCluster = false;
      em.persist(tenantCluster);

      await em.flush();

    });

  });


export const tenantAssignedPartitions = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/tenantAssignedPartitions",
      tags: ["TenantClustersPartitions"],
      summary: "获取租户授权分区列表",
    },
  })
  .input(z.object({
    tenantName: z.string(),
  }))
  .output(z.object({
    tenantName: z.string(),
    assignedPartitions: z.array(AssignedPartitionSchema),
    assignedTotalCount: z.number(),
  }))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {

        const { tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(TenantPartitionRule,
          { tenantName },
        );

        return {
          tenantName,
          assignedTotalCount: count,
          assignedPartitions: res.map((item) => ({
            clusterId: item.clusterId,
            partition: item.partition,
          })),
        };
      },
      async () => {
        return MOCK_ALL_TEN_ASSIGNED_PARTITIONS;
      },
    );


  });

export const tenantAssignedClusters = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/tenantAssignedClusters",
      tags: ["TenantClustersPartitions"],
      summary: "获取租户授权集群列表",
    },
  })
  .input(z.object({
    tenantName: z.string(),
  }))
  .output(z.object({
    tenantName: z.string(),
    assignedClusters: z.array(z.string()),
    assignedTotalCount: z.number(),
  }))
  .query(async ({ input, ctx: { user } }) => {

    return mock(
      async () => {

        const { tenantName } = input;

        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(TenantClusterRule,
          { tenantName },
        );

        return {
          tenantName,
          assignedTotalCount: count,
          assignedClusters: res.map((item) => (item.clusterId)),
        };
      },
      async () => {
        return MOCK_ALL_TEN_ASSIGNED_CLUSTERS;
      },
    );
  });

