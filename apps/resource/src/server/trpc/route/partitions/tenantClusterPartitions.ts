import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { AccountClusterRule } from "src/server/entities/AccountClusterRule";
import { AccountPartitionRule } from "src/server/entities/AccountPartitionRule";
import { TenantClusterRule } from "src/server/entities/TenantClusterRule";
import { TenantPartitionRule } from "src/server/entities/TenantPartitionRule";
import { callHook } from "src/server/hookClient";
import { getScowActivatedClusterIds, getScowActivatedClusterPartitions } from "src/server/mis-server/cluster";
import { getScowAccounts, getScowTenants } from "src/server/mis-server/tenantAccount";
import { adminAuthProcedure } from "src/server/trpc/procedure/base";
import { getAvailablePartitionsResult } from "src/server/utils/clusterPartitions";
import { assignTenantAccountsPartitionThroughCluster,
  unAssignTenantAccountsThroughCluster } from "src/server/utils/resourceAssignment";
import { checkClusterIdAvailable, checkClusterPartitionAvailable, checkSyncRunning } from "src/utils/auth/utils";
import { forkEntityManager } from "src/utils/getOrm";
import { logger } from "src/utils/logger";
import { parseIp } from "src/utils/parse";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { callLog } from "../../operationLog";
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

export const allTenantAssignedClustersPartitions = adminAuthProcedure
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
  .query(async () => {

    return mock(
      async () => {

        // 获取当前在线的集群分区信息
        const currentClusterPartitions = await getScowActivatedClusterPartitions(logger);
        const currentClusterIdsWithPartitions = Object.keys(currentClusterPartitions);

        // 当前在线集群
        const currentClusterIds = await getScowActivatedClusterIds();

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
        const result = await qbPartitions
          .select(["tenantName", "partition", "clusterId"])
          .where({ "clusterId":  { $in: currentClusterIdsWithPartitions } })
          .execute();

        // 在当前在线集群分区中过滤分区结果
        const tenantAssignedPartitionsInfo = getAvailablePartitionsResult(currentClusterPartitions, result);

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


export const assignTenantCluster = adminAuthProcedure
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
  .use(async ({ input:{ clusterId, tenantName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.authorizeCluster,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        target: { $case: "tenantName", tenantName },
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            target: { $case: "tenantName", tenantName },
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

    await checkClusterIdAvailable(clusterId);

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

export const unAssignTenantCluster = adminAuthProcedure
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
  .use(async ({ input:{ clusterId, tenantName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.unauthorizeCluster,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        target: { $case: "tenantName", tenantName },
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            target: { $case: "tenantName", tenantName },
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

    await checkClusterIdAvailable(clusterId);
    // 为了避免账户授权分区信息有冲突
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();

    const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

    if (!tenantCluster) {
      logger.info(`The cluster ${clusterId} has already been unassigned from Tenant: ${tenantName}`);
      return;
    }

    // 调用适配器，在集群下封锁租户下的账户
    const clusterProcessResult = await unAssignTenantAccountsThroughCluster(tenantName, clusterId, logger);
    const { failedBlockedAccounts, successfullyBlockedAccounts } = clusterProcessResult;

    // 在同一个事务中完成数据更新
    return await em.transactional(async (em) => {

      if (successfullyBlockedAccounts.length > 0) {
        // 移除账户集群授权数据，移除账户分区授权数据
        const deletedAccountClusterCount = await em.nativeDelete(
          AccountClusterRule,
          {
            accountName: { $in: successfullyBlockedAccounts },
            tenantName,
            clusterId,
          },
        );
        const deletedAccountPartitionCount = await em.nativeDelete(
          AccountPartitionRule,
          {
            accountName: { $in: successfullyBlockedAccounts },
            tenantName,
            clusterId,
          },
        );
        logger.info(`Removed ${deletedAccountClusterCount} account cluster rules, `
        + `${deletedAccountPartitionCount} account partition rules `
        + `during unassign cluster ${clusterId} of tenant ${tenantName}.`);

        // call hook
        await Promise.all(successfullyBlockedAccounts.map((accountName) => {
          callHook("accountUnassignedFromCluster", { accountName, tenantName, clusterId }, logger);
        }));

      };

      // 如果取消授权失败的账户数据存在
      // 只更改默认授权数据，扔出错误
      if (failedBlockedAccounts.length > 0) {
        await em.nativeUpdate(
          TenantPartitionRule,
          {
            tenantName,
            clusterId,
          },
          {
            isAccountDefaultPartition: false,
          },
        );
        await em.nativeUpdate(
          TenantClusterRule,
          {
            tenantName,
            clusterId,
          },
          {
            isAccountDefaultCluster: false,
          },
        );

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
      const deletedTenantPartitionCount = await em.nativeDelete(
        TenantPartitionRule,
        {
          tenantName,
          clusterId,
        },
      );
      logger.info(`Removed ${deletedTenantPartitionCount} tenant partition rules `
        + `during unassign cluster ${clusterId} of tenant ${tenantName}.`);

      // 避免不同事物内实体混乱，用nativeDelete执行租户集群规则实体删除
      await em.nativeDelete(
        TenantClusterRule,
        {
          tenantName,
          clusterId,
        },
      );

    });

  });



export const assignTenantPartition = adminAuthProcedure
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
  .use(async ({ input:{ clusterId, tenantName, partition }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.authorizePartition,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        partitionName: partition,
        target: { $case: "tenantName", tenantName },
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            partitionName: partition,
            target: { $case: "tenantName", tenantName },
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId, partition } = input;

    await checkClusterPartitionAvailable(clusterId, partition ,logger);

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


export const unAssignTenantPartition = adminAuthProcedure
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
  .use(async ({ input:{ clusterId, tenantName, partition }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.unauthorizePartition,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        partitionName: partition,
        target: { $case: "tenantName", tenantName },
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            partitionName: partition,
            target: { $case: "tenantName", tenantName },
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId, partition } = input;

    await checkClusterPartitionAvailable(clusterId, partition ,logger);
    // 为了避免账户授权分区信息有冲突
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();

    const tenantPartition = await em.findOne(TenantPartitionRule, { tenantName, clusterId, partition });

    if (!tenantPartition) {
      logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
          has already been unassigned from Tenant: ${tenantName}`);
      return;
    }

    const clusterProcessResult = await unAssignTenantAccountsThroughCluster(
      tenantName, clusterId, logger, partition,
    );
    const { successfullyBlockedAccounts, failedBlockedAccounts } = clusterProcessResult;

    // 在同一个数据库事务中完成数据更新
    return await em.transactional(async (em) => {
      // 如果取消授权成功的账户数据存在
      if (successfullyBlockedAccounts.length > 0) {
        // 移除账户分区授权数据
        const deletedAccountPartitionCount = await em.nativeDelete(
          AccountPartitionRule,
          {
            accountName: { $in: successfullyBlockedAccounts },
            tenantName,
            partition,
            clusterId,
          },
        );
        logger.info(`Removed ${deletedAccountPartitionCount} account partition rules `
        + `during unassign cluster's partition ${clusterId}:${partition} of tenant ${tenantName}.`);
      };

      // 如果取消授权失败的账户数据存在
      // 只更改默认授权数据，扔出错误
      if (failedBlockedAccounts.length > 0) {

        await em.nativeUpdate(
          TenantPartitionRule,
          {
            tenantName,
            clusterId,
          },
          {
            isAccountDefaultPartition: false,
          },
        );

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

      // 如果没有取消授权失败的账户数据，则移除租户授权分区数据
      // 避免不同事物内实体混乱，用nativeDelete执行租户集群规则实体删除
      await em.nativeDelete(
        TenantPartitionRule,
        {
          tenantName,
          clusterId,
          partition,
        },
      );

    });

  });


export const accountDefaultClusters = adminAuthProcedure
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
  .query(async ({ input }) => {

    return mock(
      async () => {
        const { tenantName } = input;

        // 检查现在是否有可用集群
        const currentClusterIds = await getScowActivatedClusterIds();

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(TenantClusterRule,
          { tenantName,
            isAccountDefaultCluster: true,
            clusterId: { $in: currentClusterIds },
          },
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

export const accountDefaultPartitions = adminAuthProcedure
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
  .query(async ({ input }) => {

    return mock(
      async () => {
        const { tenantName } = input;

        // 获取当前在线的集群分区信息
        const currentClusterPartitions = await getScowActivatedClusterPartitions(logger);
        const currentClusterIds = Object.keys(currentClusterPartitions);

        const em = await forkEntityManager();

        const res = await em.find(TenantPartitionRule,
          {
            tenantName,
            isAccountDefaultPartition: true,
            clusterId: { $in: currentClusterIds },
          },
        );
        // 在当前在线集群分区中过滤分区结果
        const filteredResult = getAvailablePartitionsResult(currentClusterPartitions, res);

        return {
          tenantName,
          assignedTotalCount: filteredResult.length,
          assignedPartitions: filteredResult.map((item) => ({
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

// 在租户分区授权规则中写入添加默认分区的授权信息
// 同时同步向租户下所有账户添加此分区的授权信息
// 如果账户未授权该租户所属集群，同时授权集群信息
export const addToAccountDefaultPartitions = adminAuthProcedure
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
  .output(z.object({
    failedAssignedAccounts: z.array(z.string()),
  }))
  .use(async ({ input:{ clusterId, tenantName, partition }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.addToDefaultPartitions,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        partitionName: partition,
        tenantName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            partitionName: partition,
            tenantName,
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return { failedAssignedAccounts: []};

    const { tenantName, clusterId, partition } = input;

    await checkClusterPartitionAvailable(clusterId, partition ,logger);
    // 为了避免账户授权分区信息有冲突
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();

    const [tenantCluster, tenantPartition, existedAccountPartitions ] = await Promise.all([
      em.findOne(TenantClusterRule, { tenantName, clusterId }),
      em.findOne(TenantPartitionRule, { tenantName, clusterId, partition }),
      em.find(AccountPartitionRule, {
        tenantName: tenantName,
        clusterId: clusterId,
        partition: partition,
      }),
    ]);

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

    if (!tenantPartition) {
      throw new TRPCError({
        message: `The partition (ClusterId: ${clusterId}, Name: ${partition})
           has not been assigned to Tenant: ${tenantName}`,
        code: "CONFLICT",
      });
    }

    // 为了避免不再次重复授权该账户下的分区授权信息，如果已经添加了默认分区授权信息，会报错
    if (tenantPartition.isAccountDefaultPartition) {
      throw new TRPCError({
        message: `The partition (ClusterId: ${clusterId}, Name: ${partition})
           as already been in the account default partitions of Tenant: ${tenantName}`,
        code: "CONFLICT",
      });
    }

    // 查询账户的已授权分区信息
    const existedAccountNames = existedAccountPartitions.map((x) => x.accountName);
    const clusterProcessResult = await assignTenantAccountsPartitionThroughCluster(
      tenantName, clusterId, partition, existedAccountNames, logger,
    );
    const { failedUnblockedAccounts, successfullyUnblockedAccounts, accountsToProcessInEm } = clusterProcessResult;

    return await em.transactional(async (em) => {
      const accountClustersToPersist: AccountClusterRule[] = [];
      const accountPartitionsToPersist: AccountPartitionRule[] = [];
      for (const accountName of accountsToProcessInEm) {
        // 检查集群是否已授权，如没有，则重新授权
        const accountCluster = await em.findOne(AccountClusterRule, {
          accountName,
          tenantName,
          clusterId,
        });
        if (!accountCluster) {
          const newAccountCluster = new AccountClusterRule({
            accountName,
            tenantName,
            clusterId,
          });
          accountClustersToPersist.push(newAccountCluster);
        }
        const newAccountPartition = new AccountPartitionRule({
          accountName,
          tenantName,
          clusterId,
          partition,
        });
        accountPartitionsToPersist.push(newAccountPartition);

      };

      // 为所有账户写入授权信息
      if (accountPartitionsToPersist.length > 0 || accountClustersToPersist.length > 0) {
        await Promise.all([
          em.insertMany(AccountClusterRule, accountClustersToPersist),
          em.insertMany(AccountPartitionRule, accountPartitionsToPersist),
        ]);

        // call hook
        // 同步添加租户下账户授权分区时补充添加的账户的集群授权
        await Promise.all(accountClustersToPersist.map((ac) => {
          callHook("accountAssignedToClusters", {
            accountName: ac.accountName, tenantName, clusterIds: [clusterId]}, logger);
        }));
      };
      await em.nativeUpdate(TenantPartitionRule, {
        tenantName,
        clusterId,
        partition,
      }, {
        isAccountDefaultPartition: true,
      });

      // 如果取消授权失败的账户数据存在, 返回失败的账户名
      if (failedUnblockedAccounts.length > 0) {
        logger.info(
          `Add to tenant ${tenantName} default partition ${partition} from cluster (ClusterId: ${clusterId}) failed.`
        + ` Accounts ${failedUnblockedAccounts.toString()} were failed to be assigned,`
        + ` while ${successfullyUnblockedAccounts.toString()} were successfully assigned.`,
        );
      }
      return { failedAssignedAccounts: failedUnblockedAccounts };
    });
  });

// 1.在租户集群授权规则中写入移出默认集群的授权信息
// 2.同时同步向租户下所有账户取消此分区的授权信息
export const removeFromAccountDefaultPartitions = adminAuthProcedure
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
  .output(z.object({
    failedUnassignedAccounts: z.array(z.string()),
  }))
  .use(async ({ input:{ clusterId, tenantName, partition }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.removeFromDefaultPartitions,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        partitionName: partition,
        tenantName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            partitionName: partition,
            tenantName,
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return { failedUnassignedAccounts: []};

    const { tenantName, clusterId, partition } = input;

    await checkClusterPartitionAvailable(clusterId, partition ,logger);
    // 为了避免账户授权分区信息有冲突
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();
    const em = await forkEntityManager();

    const tenantPartition = await em.findOne(TenantPartitionRule, { tenantName, clusterId, partition });

    if (!tenantPartition) {
      throw new TRPCError({
        message: `The partition (ClusterId: ${clusterId}, Name: ${partition})
           has not been assigned to Tenant: ${tenantName}`,
        code: "CONFLICT",
      });
    }
    // 为了避免不再次重复更改该账户下的分区授权信息，如果已经移出了默认分区授权信息，会报错
    if (!tenantPartition.isAccountDefaultPartition) {
      throw new TRPCError({
        message: `The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already removed from the account default partitions of Tenant: ${tenantName}`,
        code: "CONFLICT",
      });
    }

    const clusterProcessResult = await unAssignTenantAccountsThroughCluster(
      tenantName, clusterId, logger, partition,
    );
    const { failedBlockedAccounts, successfullyBlockedAccounts } = clusterProcessResult;
    // 在同一个事务下更新数据
    return await em.transactional(async (em) => {
      // 移除该租户下账户的授权分区信息
      const deletedCount = await em.nativeDelete(AccountPartitionRule, {
        accountName: { $in: successfullyBlockedAccounts },
        tenantName,
        clusterId,
        partition,
      });
      logger.info(`${deletedCount} accounts' partitions authorization is revoked `
        + `for tenant default partition ${partition} of ${tenantName} is removed`);

      // 修改租户默认授权应用在字段
      await em.nativeUpdate(TenantPartitionRule, {
        tenantName,
        clusterId,
        partition,
      }, {
        isAccountDefaultPartition: false,
      });

      // 如果取消授权失败的账户数据存在
      if (failedBlockedAccounts.length > 0) {
        logger.info(
          `Some accounts of tenant  ${tenantName} partition unassigned failed. `
          + `(ClusterId: ${clusterId}, Partition: ${partition})`
        + ` Accounts ${clusterProcessResult.failedBlockedAccounts.toString()} were failed to be unassigned,`
        + ` while ${clusterProcessResult.successfullyBlockedAccounts.toString()} were successfully unassigned.`,
        );
      }

      return { failedUnassignedAccounts: failedBlockedAccounts };
    });

  });


// 1.在租户集群授权规则中写入添加默认集群的授权信息
// 2.同时同步向租户下所有账户添加此集群授权信息
export const addToAccountDefaultClusters = adminAuthProcedure
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
  .use(async ({ input:{ clusterId, tenantName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.addToDefaultClusters,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        tenantName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            tenantName,
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return;

    const { tenantName, clusterId } = input;

    await checkClusterIdAvailable(clusterId);

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {

      const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

      if (!tenantCluster) {
        throw new TRPCError({
          message: `The cluster (ClusterId: ${clusterId}) has not been assigned to Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      // 为了避免不再次重复授权该账户下的集群授权信息，如果已经添加了默认集群授权信息，会报错
      if (tenantCluster.isAccountDefaultCluster) {
        throw new TRPCError({
          message: `The cluster (ClusterId: ${clusterId}) has already been in`
          + ` the account default partitions of Tenant: ${tenantName}`,
          code: "CONFLICT",
        });
      }

      // 在 scow 下获取租户 tenantName 下的所有账户
      const scowTenantAccounts = await getScowAccounts(tenantName);
      const accountNameList = scowTenantAccounts.results.map((a) => a.accountName);

      // 查找账户已授权集群信息
      const accountClusters = await em.find(AccountClusterRule, {
        tenantName: tenantName,
        clusterId: clusterId,
      });
      const existedAccountNames = accountClusters.map((x) => x.accountName);

      const accountClustersToPersist: AccountClusterRule[] = [];
      accountNameList.forEach((accountName) => {
        if (!existedAccountNames.includes(accountName)) {
          const newAccountCluster = new AccountClusterRule({
            accountName,
            tenantName,
            clusterId,
          });
          accountClustersToPersist.push(newAccountCluster);
        }
      });
      // 为所有账户写入集群的授权信息
      if (accountClustersToPersist.length > 0) {
        await em.insertMany(AccountClusterRule, accountClustersToPersist);
        // call hook
        await Promise.all(accountClustersToPersist.map((ac) => {
          callHook("accountAssignedToClusters", {
            accountName: ac.accountName, tenantName, clusterIds: [clusterId]}, logger);
        }));
      }

      tenantCluster.isAccountDefaultCluster = true;
      await em.persistAndFlush(tenantCluster);
    });

  });

// 1.在租户集群授权规则中写入移出默认集群的授权信息
// 2.同时移出租户下所有账户的此集群授权信息
export const removeFromAccountDefaultClusters = adminAuthProcedure
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
  .output(z.object({
    failedUnassignedAccounts: z.array(z.string()),
  }))
  .use(async ({ input:{ clusterId, tenantName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.removeFromDefaultClusters,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:{
        clusterId,
        tenantName,
      },
      },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
          {
            clusterId,
            tenantName,
          },
      },
      OperationResult.FAIL);
    }
    return res;
  })
  .mutation(async ({ input }) => {

    if (USE_MOCK) return { failedUnassignedAccounts: []};

    const { tenantName, clusterId } = input;

    await checkClusterIdAvailable(clusterId);
    // 为了避免账户授权分区信息有冲突
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();
    const tenantCluster = await em.findOne(TenantClusterRule, { tenantName, clusterId });

    if (!tenantCluster) {
      throw new TRPCError({
        message: `The partition (ClusterId: ${clusterId}) has not been assigned to Tenant: ${tenantName}`,
        code: "CONFLICT",
      });
    }
    // 为了避免不再次重复取消账户下的集群授权信息，如果已经移出了默认集群授权信息，会报错
    if (!tenantCluster.isAccountDefaultCluster) {
      throw new TRPCError({
        message: `The cluster (ClusterId: ${clusterId}) has already removed from Tenant: ${tenantName}`,
        code: "CONFLICT",
      });
    }

    const clusterProcessResult = await unAssignTenantAccountsThroughCluster(
      tenantName, clusterId, logger,
    );
    const { failedBlockedAccounts, successfullyBlockedAccounts } = clusterProcessResult;

    // 在同一个事务中进行数据更新
    return await em.transactional(async (em) => {
      // 取消账户集群/分区的授权
      if (successfullyBlockedAccounts.length > 0) {
        const deletedAccountClusterCount = await em.nativeDelete(
          AccountClusterRule, {
            accountName: { $in: successfullyBlockedAccounts },
            tenantName,
            clusterId,
          },
        );

        const deletedAccountPartitionCount = await em.nativeDelete(
          AccountPartitionRule, {
            accountName: { $in: successfullyBlockedAccounts },
            tenantName,
            clusterId,
          },
        );
        logger.info(`Successfully unassign ${deletedAccountClusterCount} account cluster rules `
          + `and ${deletedAccountPartitionCount} account partition rules during remove `
          + `default cluster ${clusterId} from tenant ${tenantName}`,
        );

        // call hook
        await Promise.all(successfullyBlockedAccounts.map((accountName) => {
          callHook("accountUnassignedFromCluster", {
            accountName, tenantName, clusterId }, logger);
        }));
      }

      // 更新租户分区的默认分区字段
      const updatedTenantPartitionCount = await em.nativeUpdate(
        TenantPartitionRule, {
          tenantName,
          clusterId,
        },
        { isAccountDefaultPartition: false },
      );
      logger.info(`Successfully update ${updatedTenantPartitionCount} tenant partition rules `
          + `during remove default cluster ${clusterId} from tenant ${tenantName}`,
      );

      // 更新租户集群的默认集群字段
      await em.nativeUpdate(
        TenantClusterRule, {
          tenantName,
          clusterId,
        },
        { isAccountDefaultCluster: false },
      );

      // 如果取消授权失败的账户数据存在
      if (failedBlockedAccounts.length > 0) {
        logger.info(
          `Some accounts of tenant  ${tenantName} partition unassigned failed in Cluster ${clusterId}. `
        + ` Accounts ${clusterProcessResult.failedBlockedAccounts.toString()} were failed to be unassigned,`
        + ` while ${clusterProcessResult.successfullyBlockedAccounts.toString()} were successfully unassigned.`,
        );
      }

      return { failedUnassignedAccounts: failedBlockedAccounts };

    });
  });


export const tenantAssignedPartitions = adminAuthProcedure
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
  .query(async ({ input }) => {

    return mock(
      async () => {

        const { tenantName } = input;

        // 获取当前在线的集群分区信息
        const currentClusterPartitions = await getScowActivatedClusterPartitions(logger);
        const currentClusterIds = Object.keys(currentClusterPartitions);

        const em = await forkEntityManager();

        const res = await em.find(TenantPartitionRule,
          { tenantName,
            clusterId: { $in: currentClusterIds },
          },
        );
        const filteredResult = getAvailablePartitionsResult(currentClusterPartitions, res);

        return {
          tenantName,
          assignedTotalCount: filteredResult.length,
          assignedPartitions: filteredResult.map((item) => ({
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

export const tenantAssignedClusters = adminAuthProcedure
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
  .query(async ({ input }) => {

    return mock(
      async () => {

        const { tenantName } = input;

        // 检查现在是否有可用集群
        const currentClusterIds = await getScowActivatedClusterIds();

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(TenantClusterRule,
          {
            tenantName,
            clusterId: { $in: currentClusterIds },
          },
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

