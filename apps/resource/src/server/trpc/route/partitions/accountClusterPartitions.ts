import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { ensureResourceManagementFeatureAvailable } from "@scow/lib-server";
import { Account } from "@scow/protos/build/server/account";
import { TRPCError } from "@trpc/server";
import { AssignedInfoSortBy, AssignmentState, SortOrder } from "src/models/partition";
import { AccountClusterRule } from "src/server/entities/AccountClusterRule";
import { AccountPartitionRule } from "src/server/entities/AccountPartitionRule";
import { TenantClusterRule } from "src/server/entities/TenantClusterRule";
import { TenantPartitionRule } from "src/server/entities/TenantPartitionRule";
import { callHook } from "src/server/hookClient";
import { getScowActivatedClusterIds, getScowActivatedClusterPartitions } from "src/server/mis-server/cluster";
import { getScowAccounts } from "src/server/mis-server/tenantAccount";
import { adminAuthProcedure } from "src/server/trpc/procedure/base";
import { getAvailablePartitionsResult } from "src/server/utils/clusterPartitions";
import { checkClusterIdAvailable, checkClusterPartitionAvailable, checkSyncRunning } from "src/utils/auth/utils";
import { getClusterUtils } from "src/utils/clusterAdapter";
import { DEFAULT_ERROR_MESSAGE, DEFAULT_PAGE_SIZE } from "src/utils/constants";
import { forkEntityManager } from "src/utils/getOrm";
import { logger } from "src/utils/logger";
import { paginationSchema } from "src/utils/pagination";
import { parseIp } from "src/utils/parse";
import { USE_MOCK } from "src/utils/processEnv";
import { z } from "zod";

import { callLog } from "../../operationLog";
import { mock, MOCK_ALL_ACC_ASSIGNED_PARTITIONS, MOCK_ALL_ACCT_ASSIGNED_INFO } from "../mock";
import { AllAssignedInfoSchema } from "./tenantClusterPartitions";

export const AssignedPartitionSchema = z.object({
  clusterId: z.string(),
  partition: z.string(),
});

// 在租户已授权数据下获取账户的集群和分区授权详细信息，包括未授权及已授权
// 方案采用一次拉取全量数据+内存聚合，减少大数据下的数据库IO和网络往返
export const accountsAssignedDetails = adminAuthProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountsAssignedDetails",
      tags: ["AccountClustersPartitions"],
      summary: "在租户已授权数据下获取账户的集群和分区授权数据",
    },
  })
  .input(
    z.object({
      tenantName: z.string(),
      page: paginationSchema.shape.page.default(1),
      pageSize: paginationSchema.shape.pageSize.default(DEFAULT_PAGE_SIZE),
      sortBy: z.enum(AssignedInfoSortBy).optional(),
      sortOrder: z.enum(SortOrder).optional(),
      searchAccountText: z.string().optional(),
      searchOwnerText: z.string().optional(),
    }),
  )
  .output(
    z.object({
      items: z.array(AllAssignedInfoSchema),
      total: z.number(),
      noPartitionClusterIds: z.array(z.string()),
    }),
  )
  .query(async ({ input }) => {
    return mock(
      async () => {
        const { tenantName, page, pageSize, sortBy, sortOrder, searchAccountText, searchOwnerText } = input;
        // 并行获取基础数据
        const [currentClusterIds, currentClusterPartitions, allTenantAccounts] = await Promise.all([
          getScowActivatedClusterIds().catch((e) => {
            logger.error("Activated clusters fetch failed: %s", e);
            throw new TRPCError({
              message: `Can not find activated clusters: ${e.message || e.details || DEFAULT_ERROR_MESSAGE}`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }),
          getScowActivatedClusterPartitions(logger).catch((e) => {
            logger.error("Activated cluster partitions fetch failed: %s", e);
            throw new TRPCError({
              message: `Can not find activated cluster partitions: ${e.message || e.details || DEFAULT_ERROR_MESSAGE}`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }),
          getScowAccounts(tenantName).catch((e) => {
            logger.error("Accounts of tenant %s fetch failed: %s", tenantName, e);
            throw new TRPCError({
              message: `Can not find accounts of tenant ${tenantName}: ${e.message || e.details || DEFAULT_ERROR_MESSAGE}`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }),
        ]);
        // 获取无法拿到分区信息的异常集群数据
        const totalNoPartitionClusters: string[] = currentClusterIds.filter(
          (clusterId) => !Object.keys(currentClusterPartitions).includes(clusterId),
        );

        // 定义数据库返回的原始数据结构
        interface RawAccountClusterRule {
          accountName: string;
          clusterId: string;
        }

        interface RawAccountPartitionRule {
          accountName: string;
          clusterId: string;
          partition: string;
        }

        interface RawTenantClusterRule {
          tenantName: string;
          clusterId: string;
        }
        interface RawTenantPartitionRule {
          tenantName: string;
          clusterId: string;
          partition: string;
        }

        const em = await forkEntityManager();
        // 获取租户已授权数据作为账户查询的数据边界
        const [tenantClusterRules, tenantPartitionRules] = await Promise.all([
          em
            .createQueryBuilder(TenantClusterRule)
            .select(["clusterId"])
            .where({ tenantName, clusterId: { $in: currentClusterIds } })
            .execute<RawTenantClusterRule[]>(),
          em
            .createQueryBuilder(TenantPartitionRule)
            .select(["clusterId", "partition"])
            .where({ tenantName, clusterId: { $in: currentClusterIds } })
            .execute<RawTenantPartitionRule[]>(),
        ]);
        const tenantAssignedActivatedClusterIds = tenantClusterRules.map((c) => c.clusterId);

        // 结合租户已授权分区及异常数据，获取到账户授权信息中的异常集群信息数据
        const noPartitionClusterIds = tenantAssignedActivatedClusterIds.filter((id) =>
          totalNoPartitionClusters.includes(id),
        );
        if (tenantAssignedActivatedClusterIds.length === 0) {
          return { items: [], total: 0, noPartitionClusterIds };
        }

        let filteredAccounts: Account[] = allTenantAccounts.results;

        if (searchOwnerText) {
          filteredAccounts = filteredAccounts.filter(
            (a) =>
              a.ownerName?.toLowerCase().includes(searchOwnerText.toLowerCase()) ||
              a.ownerId?.toLowerCase().includes(searchOwnerText.toLowerCase()),
          );
        }
        if (searchAccountText) {
          filteredAccounts = filteredAccounts.filter((account) =>
            account.accountName.toLowerCase().includes(searchAccountText.toLowerCase()),
          );
        }
        // 如果过滤后没数据直接返回
        if (filteredAccounts.length === 0) {
          return { items: [], total: 0, noPartitionClusterIds };
        }

        // 全量预取数据，之后在内存中处理数据
        const [allClusterRules, allPartitionRules] = await Promise.all([
          em
            .createQueryBuilder(AccountClusterRule)
            .select(["accountName", "clusterId"])
            .where({
              tenantName,
              clusterId: { $in: tenantAssignedActivatedClusterIds },
            })
            .execute<RawAccountClusterRule[]>(),

          em
            .createQueryBuilder(AccountPartitionRule)
            .select(["accountName", "clusterId", "partition"])
            .where({ tenantName })
            .execute<RawAccountPartitionRule[]>(),
        ]);

        // partitions:Set<string>  使用Key组合防止嵌套循环, 存储 "clusterId:partition"
        const accountClusterPartitionMap = new Map<string, { clusters: Set<string>; partitions: Set<string> }>();
        filteredAccounts.forEach((a) =>
          accountClusterPartitionMap.set(a.accountName, { clusters: new Set(), partitions: new Set() }),
        );
        // 映射集群规则
        allClusterRules.forEach((rule) => {
          const entry = accountClusterPartitionMap.get(rule.accountName);
          if (entry) entry.clusters.add(rule.clusterId);
        });
        // 映射分区规则
        // 先把租户的有效集群已授权的分区存入 Set 提高查找速度
        const validPartitionRules = tenantPartitionRules.filter((p) => !noPartitionClusterIds.includes(p.clusterId));
        const validPartitions = new Set(validPartitionRules.map((p) => `${p.clusterId}:${p.partition}`));
        allPartitionRules.forEach((rule) => {
          const entry = accountClusterPartitionMap.get(rule.accountName);
          if (entry && validPartitions.has(`${rule.clusterId}:${rule.partition}`)) {
            entry?.partitions.add(`${rule.clusterId}:${rule.partition}`);
          }
        });

        // 组装带有已授权数量的结果
        const allResults = filteredAccounts.map((account) => {
          const accountAssignedInfo = accountClusterPartitionMap.get(account.accountName)!;
          return {
            accountName: account.accountName,
            ownerId: account.ownerId,
            ownerName: account.ownerName,
            tenantName: tenantName,
            assignedClustersCount: accountAssignedInfo.clusters.size,
            assignedPartitionsCount: accountAssignedInfo.partitions.size,
            _clustersSet: accountAssignedInfo.clusters,
            _partitionsSet: accountAssignedInfo.partitions,
          };
        });

        // 进行排序及分页
        if (sortBy && sortOrder) {
          allResults.sort((a, b) => {
            let compareValue = 0;
            if (sortBy === AssignedInfoSortBy.NAME) {
              compareValue = a.accountName.localeCompare(b.accountName);
            } else if (sortBy === AssignedInfoSortBy.ASSIGNED_CLUSTERS_COUNT) {
              compareValue = a.assignedClustersCount - b.assignedClustersCount;
            } else if (sortBy === AssignedInfoSortBy.ASSIGNED_PARTITIONS_COUNT) {
              compareValue = a.assignedPartitionsCount - b.assignedPartitionsCount;
            }
            return sortOrder === SortOrder.ASCEND ? compareValue : -compareValue;
          });
        }

        const total = allResults.length;

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginated = allResults.slice(startIndex, endIndex);

        if (paginated.length === 0) {
          return { items: [], total, noPartitionClusterIds };
        }

        const items = paginated.map((p) => {
          const aName = p.accountName;
          return {
            accountName: aName,
            ownerId: p.ownerId ?? "-",
            ownerName: p.ownerName ?? "-",
            tenantName: p.tenantName,
            assignedInfo: {
              assignedClusters: tenantClusterRules.map((tc) => ({
                clusterId: tc.clusterId,
                assignmentState: p._clustersSet.has(tc.clusterId)
                  ? AssignmentState.ASSIGNED
                  : AssignmentState.UNASSIGNED,
              })),
              assignedClustersCount: p.assignedClustersCount,
              assignedPartitions: validPartitionRules.map((tp) => {
                const partitionKey = `${tp.clusterId}:${tp.partition}`;
                return {
                  clusterId: tp.clusterId,
                  partition: tp.partition,
                  assignmentState: p._partitionsSet.has(partitionKey)
                    ? AssignmentState.ASSIGNED
                    : AssignmentState.UNASSIGNED,
                };
              }),
              assignedPartitionsCount: p.assignedPartitionsCount,
            },
          };
        });

        return { items, total, noPartitionClusterIds };
      },

      async () => {
        return { items: MOCK_ALL_ACCT_ASSIGNED_INFO as any, total: 100, noPartitionClusterIds: [] };
      },
    );
  });

export const assignAccountCluster = adminAuthProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/assignAccountCluster",
      tags: ["AccountClustersPartitions"],
      summary: "授权账户集群",
    },
  })
  .input(
    z.object({
      tenantName: z.string(),
      accountName: z.string(),
      clusterId: z.string(),
    }),
  )
  .output(z.void())
  .use(async ({ input: { clusterId, accountName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.authorizeCluster,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.FAIL,
      );
    }
    return res;
  })
  .mutation(async ({ input }) => {
    if (USE_MOCK) return;

    const { tenantName, accountName, clusterId } = input;

    await checkClusterIdAvailable(clusterId);
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

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

    await callHook("accountAssignedToClusters", { accountName, tenantName, clusterIds: [clusterId] }, logger);
  });

export const unAssignAccountCluster = adminAuthProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/unassignAccountCluster",
      tags: ["AccountPartitions"],
      summary: "取消授权账户集群",
    },
  })
  .input(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
      clusterId: z.string(),
    }),
  )
  .output(z.void())
  .use(async ({ input: { clusterId, accountName }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.unauthorizeCluster,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.FAIL,
      );
    }
    return res;
  })
  .mutation(async ({ input }) => {
    if (USE_MOCK) return;

    const { accountName, tenantName, clusterId } = input;

    await checkClusterIdAvailable(clusterId);
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {
      const accountCluster = await em.findOne(AccountClusterRule, {
        accountName,
        tenantName,
        clusterId,
      });

      if (!accountCluster) {
        logger.info(`The account ${accountName} of tenant ${tenantName}
              has already been unassigned from cluster: ${clusterId}`);
        return;
      }

      // 确保正常账户在集群的所有分区已封锁
      const accountInfo = await getScowAccounts(tenantName, accountName);
      const clustersUtil = await getClusterUtils();
      if (!accountInfo.results[0].blocked) {
        await clustersUtil
          .callOnOne(clusterId, logger, async (adapterClient) => {
            const clusterConfig = await asyncClientCall(adapterClient.config, "getClusterConfig", {});
            // 1.获取当前集群下所有分区
            const partitionNames = clusterConfig.partitions.map((p) => p.name);

            // 2.封锁当前集群下所有分区
            if (partitionNames.length > 0) {
              await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
                accountName,
                blockedPartitions: partitionNames,
              });
            }
          })
          .catch((e) => {
            logger.error(
              "Block account %s in cluster (clusterId: %s) failed with error details: %s",
              accountName,
              clusterId,
              e,
            );
            const message = e.details || e.message || DEFAULT_ERROR_MESSAGE;
            throw new TRPCError({
              message:
                `Can not block the unblocked account ${accountName} in cluster (ClusterId: ${clusterId}): ` +
                `${message}.`,
              code: "CONFLICT",
            });
          });
      }

      const removedAccountPartitions = await em.find(AccountPartitionRule, {
        accountName,
        tenantName,
        clusterId,
      });

      // 移除在该集群的已授权信息, 移除该集群下分区的已授权信息
      em.remove([accountCluster, ...removedAccountPartitions]);

      await em.flush();

      await callHook("accountUnassignedFromCluster", { accountName, tenantName, clusterId }, logger);
    });
  });

export const assignAccountPartition = adminAuthProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/assignAccountPartition",
      tags: ["AccountClustersPartitions"],
      summary: "为账户授权分区",
    },
  })
  .input(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
      clusterId: z.string(),
      partition: z.string(),
    }),
  )
  .output(z.void())
  .use(async ({ input: { clusterId, accountName, partition }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.authorizePartition,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            partitionName: partition,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            partitionName: partition,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.FAIL,
      );
    }
    return res;
  })
  .mutation(async ({ input }) => {
    if (USE_MOCK) return;

    const { accountName, tenantName, clusterId, partition } = input;

    await checkClusterPartitionAvailable(clusterId, partition, logger);
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {
      const accountPartition = await em.findOne(AccountPartitionRule, {
        accountName,
        tenantName,
        clusterId,
        partition,
      });

      if (accountPartition) {
        logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already been assigned to Account: ${accountName}`);
        return;
      }

      // 确保正常账户在集群的此分区下同时解封
      const accountInfo = await getScowAccounts(tenantName, accountName);
      const clustersUtil = await getClusterUtils();
      if (!accountInfo.results[0].blocked) {
        await clustersUtil
          .callOnOne(
            clusterId,

            logger,
            async (adapterClient) => {
              // 检查当前适配器是否具有资源管理可选功能接口，同时判断当前适配器版本
              await ensureResourceManagementFeatureAvailable(adapterClient, logger);
              await asyncClientCall(adapterClient.account, "unblockAccountWithPartitions", {
                accountName,
                unblockedPartitions: [partition],
              });
            },
          )
          .catch((e) => {
            logger.error(
              "Unblock account %s in partition (clusterId: %s, partitionName: %s) failed with error details: %s",
              accountName,
              clusterId,
              partition,
              e,
            );
            const message = e.details || e.message || DEFAULT_ERROR_MESSAGE;
            throw new TRPCError({
              message:
                `Can not unblock the account ${accountName} in partition` +
                `(ClusterId: ${clusterId}, Name: ${partition}): ${message}`,
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

export const unAssignAccountPartition = adminAuthProcedure
  .meta({
    openapi: {
      method: "PUT",
      path: "/unassignAccountPartition",
      tags: ["AccountPartitions"],
      summary: "取消授权账户可用分区",
    },
  })
  .input(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
      clusterId: z.string(),
      partition: z.string(),
    }),
  )
  .output(z.void())
  .use(async ({ input: { clusterId, accountName, partition }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.unauthorizePartition,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            partitionName: partition,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            partitionName: partition,
            target: { $case: "accountName", accountName },
          },
        },
        OperationResult.FAIL,
      );
    }
    return res;
  })
  .mutation(async ({ input }) => {
    if (USE_MOCK) return;

    const { accountName, tenantName, clusterId, partition } = input;

    await checkClusterPartitionAvailable(clusterId, partition, logger);
    // 检查当前是否有正在进行的账户用户同步任务
    await checkSyncRunning();

    const em = await forkEntityManager();

    return await em.transactional(async (em) => {
      const accountPartition = await em.findOne(AccountPartitionRule, {
        accountName,
        tenantName,
        clusterId,
        partition,
      });

      if (!accountPartition) {
        logger.info(`The partition (ClusterId: ${clusterId}, Name: ${partition})
           has already been unassigned from Account: ${accountName}`);
        return;
      }

      // 确保正常账户在集群的此分区已封锁
      const accountInfo = await getScowAccounts(tenantName, accountName);
      const clustersUtil = await getClusterUtils();
      if (!accountInfo.results[0].blocked) {
        await clustersUtil
          .callOnOne(clusterId, logger, async (adapterClient) => {
            await ensureResourceManagementFeatureAvailable(adapterClient, logger);
            await asyncClientCall(adapterClient.account, "blockAccountWithPartitions", {
              accountName,
              blockedPartitions: [partition],
            });
          })
          .catch((e) => {
            logger.info(
              "Block account %s in partition (clusterId: %s, partitionName: %s) failed with error details: %o",
              accountName,
              clusterId,
              partition,
              e,
            );
            const message = e.details || e.message || DEFAULT_ERROR_MESSAGE;
            throw new TRPCError({
              message:
                `Can not block the account ${accountName} in partition` +
                `(ClusterId: ${clusterId}, Name: ${partition}): ${message}`,
              code: "CONFLICT",
            });
          });
      }

      em.remove(accountPartition);

      await em.flush();
    });
  });

export const accountAssignedPartitions = adminAuthProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountPartitions",
      tags: ["AccountClustersPartitions"],
      summary: "获取账户已授权分区列表",
    },
  })
  .input(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
    }),
  )
  .output(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
      assignedPartitions: z.array(AssignedPartitionSchema),
      assignedTotalCount: z.number(),
    }),
  )
  .query(async ({ input }) => {
    return mock(
      async () => {
        const { accountName, tenantName } = input;

        // 获取当前在线的集群分区信息
        const currentClusterPartitions = await getScowActivatedClusterPartitions(logger);
        const currentClusterIds = Object.keys(currentClusterPartitions);

        const em = await forkEntityManager();

        const res = await em.find(AccountPartitionRule, {
          accountName,
          tenantName,
          clusterId: { $in: currentClusterIds },
        });
        const filteredResult = getAvailablePartitionsResult(currentClusterPartitions, res);

        return {
          accountName,
          tenantName: tenantName,
          assignedPartitions: filteredResult.map((item) => ({
            clusterId: item.clusterId,
            partition: item.partition,
          })),
          assignedTotalCount: filteredResult.length,
        };
      },
      async () => {
        return MOCK_ALL_ACC_ASSIGNED_PARTITIONS as any;
      },
    );
  });

export const accountAssignedClusters = adminAuthProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/accountAssignedClusters",
      tags: ["AccountClustersPartitions"],
      summary: "获取账户已授权集群列表",
    },
  })
  .input(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
    }),
  )
  .output(
    z.object({
      accountName: z.string(),
      tenantName: z.string(),
      assignedClusters: z.array(z.string()),
      assignedTotalCount: z.number(),
    }),
  )
  .query(async ({ input }) => {
    return mock(
      async () => {
        const { accountName, tenantName } = input;

        const currentClusterIds = await getScowActivatedClusterIds();

        const em = await forkEntityManager();

        const [res, count] = await em.findAndCount(AccountClusterRule, {
          accountName,
          tenantName,
          clusterId: { $in: currentClusterIds },
        });

        return {
          accountName,
          tenantName,
          assignedClusters: res.map((x) => x.clusterId),
          assignedTotalCount: count,
        };
      },
      async () => {
        return MOCK_ALL_ACC_ASSIGNED_PARTITIONS as any;
      },
    );
  });
