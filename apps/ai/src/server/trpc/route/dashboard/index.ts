import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AppConfigSchema } from "@scow/config/build/appForAi";
import { getCommonConfig } from "@scow/config/src/common";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { PartitionInfo_PartitionStatus, SummaryPartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";
import { NodeInfo_NodeState } from "@scow/protos/build/portal/config";
import { AccountState } from "@scow/protos/build/server/user";
import { TRPCError } from "@trpc/server";
import { promises as fsPromises } from "fs";
import path from "path";
import { config } from "src/server/config/env";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { getClusterAppConfigs } from "src/server/utils/app";
import { getAdapterClient } from "src/server/utils/clusters";
import { logger } from "src/server/utils/logger";
import { z } from "zod";

// 定义分区信息
export const PartitionSchema = z.object({
  partitionName: z.string(),
  nodeCount: z.number(),
  runningNodeCount: z.number(),
  idleNodeCount: z.number(),
  notAvailableNodeCount: z.number().optional(),
  cpuCoreCount: z.number(),
  runningCpuCount: z.number(),
  idleCpuCount: z.number(),
  notAvailableCpuCount: z.number().optional(),
  gpuCoreCount: z.number(),
  runningGpuCount: z.number(),
  idleGpuCount: z.number(),
  notAvailableGpuCount: z.number().optional(),
  jobCount: z.number(),
  runningJobCount: z.number(),
  pendingJobCount: z.number(),
  usageRatePercentage: z.number(),
  partitionStatus: z.enum(PartitionInfo_PartitionStatus),
  gpuModel: z.string().optional(),
  acceleratorDescriptions: z.array(z.string()),
  totalMemMb: z.number(),
  allocMemMb: z.number(),
});

// 定义集群信息
const ClusterInfoSchema = z.object({
  partitions: z.array(PartitionSchema), // 分区列表
});

// 定义汇总分区信息
export const SummaryPartitionSchema = z.object({
  partitionName: z.string(),
  nodeCount: z.number(),
  nodeUsage: z.number(),
  cpuCoreCount: z.optional(z.number()),
  cpuUsage: z.number(),
  gpuCoreCount: z.optional(z.number()),
  gpuUsage: z.number(),
  pendingJobCount: z.number(),
  partitionStatus: z.nativeEnum(SummaryPartitionInfo_PartitionStatus),
});

// 定义汇总集群信息
const SummaryClusterInfoSchema = z.array(
  z.object({
    clusterId: z.string(),
    nodeCount: z.number(),
    runningNodeCount: z.number(),
    idleNodeCount: z.number(),
    notAvailableNodeCount: z.optional(z.number()),
    cpuCoreCount: z.number(),
    runningCpuCount: z.number(),
    idleCpuCount: z.number(),
    notAvailableCpuCount: z.optional(z.number()),
    gpuCoreCount: z.number(),
    runningGpuCount: z.number(),
    idleGpuCount: z.number(),
    notAvailableGpuCount: z.optional(z.number()),
    runningJobCount: z.number(),
    pendingJobCount: z.number(),
    nodeUsage: z.number(),
    cpuUsage: z.number(),
    gpuUsage: z.number(),
    partitions: z.array(SummaryPartitionSchema),
  }),
);

export const NodeInfoSchema = z.object({
  nodeName: z.string(),
  partitions: z.array(z.string()),
  state: z.enum(NodeInfo_NodeState),
  cpuCoreCount: z.number(),
  allocCpuCoreCount: z.number(),
  idleCpuCoreCount: z.number(),
  totalMemMb: z.number(),
  allocMemMb: z.number(),
  idleMemMb: z.number(),
  gpuCount: z.number(),
  allocGpuCount: z.number(),
  idleGpuCount: z.number(),
});

// 更新集群节点信息的输出模式
const ClusterNodesInfoSchema = z.object({
  nodeInfo: z.array(NodeInfoSchema),
});

const ClusterNodesInfoInput = z.object({
  clusterId: z.string(),
  nodeNames: z.string().optional(), // 将 nodeNames 定义为逗号分隔的字符串
});

// 批量获取集群信息的输入和输出模式
const AllClustersInfoInput = z.object({
  clusterIds: z.array(z.string()),
  isFullDisplayMode: z.boolean().optional(),
});

const AllSummaryClustersInfoInput = AllClustersInfoInput.extend({
  userId: z.string(),
});

const AllClustersInfoSchema = z.object({
  clusters: z.array(
    ClusterInfoSchema.extend({
      clusterId: z.string(),
    }),
  ),
});

// 批量获取集群节点信息的输入和输出模式
const AllClustersNodesInfoInput = z.object({
  clusterIds: z.array(z.string()),
});

const AllClustersNodesInfoSchema = z.object({
  clusters: z.array(
    ClusterNodesInfoSchema.extend({
      clusterId: z.string(),
    }),
  ),
});

export const PageLinkEntrySchema = z.object({
  path: z.string(),
  /** antd的图标ID */
  icon: z.string(),
});

export const ClusterPageLinkEntrySchema = z.object({
  clusterId: z.string(),
  path: z.string(),
  /** antd的图标ID */
  icon: z.string(),
});

export const AppEntrySchema = z.object({
  appId: z.string(),
  clusterId: z.string(),
  /**
   * 应用图标的路径
   * 只在getQuickEntriesResponse中使用，获取查询时config下配置的应用图标路径
   * 前端会根据这个路径加载应用图标
   */
  appLogoPath: z.string().optional(),
});

export const ShellEntrySchema = z.object({
  clusterId: z.string(),
  loginNode: z.string(),
  /** antd的图标ID */
  icon: z.string(),
});

const quickEntryPath = "/var/lib/scow/ai/quickEntries";

const EntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  entry: z
    .union([
      z.object({
        $case: z.literal("pageLink"),
        pageLink: PageLinkEntrySchema,
      }),
      z.object({
        $case: z.literal("clusterPageLink"),
        clusterPageLink: ClusterPageLinkEntrySchema,
      }),
      z.object({
        $case: z.literal("app"),
        app: AppEntrySchema,
      }),
      z.object({
        $case: z.literal("shell"),
        shell: ShellEntrySchema,
      }),
      z.undefined(),
    ])
    .optional(),
});

const EntryListSchema = z.array(EntrySchema);

export type EntryListSchema = z.infer<typeof EntryListSchema>;

// tRPC 路由
export const dashboard = router({
  // 获取集群配置信息
  getClusterInfo: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/dashboard/cluster", // 定义 API 路径
        tags: ["dashboard"], // 标签分类
        summary: "clusterInfo", // 接口的简要说明
      },
    })
    // 输入为集群 ID
    .input(z.object({ clusterId: z.string() }))
    // 输出为集群配置
    .output(ClusterInfoSchema)
    .query(async ({ input }) => {
      const { clusterId } = input;

      const client = getAdapterClient(clusterId);
      if (!client) {
        // 如果找不到集群，抛出 404 错误
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Cluster ${clusterId} is not found`,
        });
      }

      const reply = await asyncClientCall(client.config, "getClusterInfo", {
        cluster: clusterId,
      });

      // 返回集群信息
      return {
        // 不能使用适配器返回的集群名称
        // 适配器返回的集群名称是 slurm 的集群名，不一定和 scow 集群名匹配
        clusterName: clusterId,
        partitions: reply.partitions, // 分区信息
      };
    }),

  getClusterNodesInfo: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/dashboard/nodes", // 定义 API 路径
        tags: ["dashboard"], // 标签分类
        summary: "clusterNodesInfo", // 接口的简要说明
      },
    })
    // 输入包含集群 ID 和可选节点名称
    .input(ClusterNodesInfoInput)
    .output(ClusterNodesInfoSchema)
    .query(async ({ input }) => {
      const { clusterId, nodeNames } = input;

      const client = getAdapterClient(clusterId);
      if (!client) {
        // 如果找不到集群，抛出 404 错误
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Cluster ${clusterId} is not found`,
        });
      }

      const nodeNamesArray = nodeNames ? nodeNames.split(",") : [];

      const reply = await asyncClientCall(client.config, "getClusterNodesInfo", {
        nodeNames: nodeNamesArray,
      });

      // 返回节点信息
      return {
        nodeInfo: reply.nodes, // 节点信息
      };
    }),

  // 批量获取多个集群的信息
  getAllClustersInfo: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/dashboard/clusters",
        tags: ["dashboard"],
        summary: "Get all clusters info",
      },
    })
    .input(AllClustersInfoInput)
    .output(AllClustersInfoSchema)
    .query(async ({ input }) => {
      const { clusterIds, isFullDisplayMode } = input;

      const results = await Promise.allSettled(
        clusterIds.map(async (clusterId) => {
          const client = getAdapterClient(clusterId);
          if (!client) {
            throw new Error(`Cluster ${clusterId} is not found`);
          }

          const reply = await asyncClientCall(client.config, "getClusterInfo", {
            cluster: clusterId,
          });

          if (isFullDisplayMode || isFullDisplayMode === undefined) {
            return {
              clusterId,
              partitions: reply.partitions,
            };
          } else {
            return {
              clusterId,
              partitions: reply.partitions.map((partition) => ({
                ...partition,
                notAvailableNodeCount: undefined,
                notAvailableCpuCount: undefined,
                notAvailableGpuCount: undefined,
              })),
            };
          }
        }),
      );

      const clusters = results
        .map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            const clusterId = clusterIds[index];
            const errorMessage = result.reason?.message || "Unknown error";
            console.error(`Failed to get cluster info for ${clusterId}: ${errorMessage}`);
            return null;
          }
        })
        .filter((cluster) => cluster !== null);

      return { clusters };
    }),

  // 批量获取多个集群的整合信息
  getAllSummaryClustersInfo: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/dashboard/summaryClusters",
        tags: ["dashboard"],
        summary: "Get all clusters summary info",
      },
    })
    .input(AllSummaryClustersInfoInput)
    .output(SummaryClusterInfoSchema)
    .query(async ({ input }) => {
      const { clusterIds, isFullDisplayMode, userId } = input;

      const commonConfig = getCommonConfig();

      const userAffliction = await libWebGetUserInfo(userId, config.MIS_SERVER_URL, commonConfig.scowApi.auth.token);

      const accountNames =
        userAffliction?.affiliations
          .filter((x) => x.accountState !== AccountState.ACCOUNT_DELETED)
          .map((a) => a.accountName) || [];

      const results = await Promise.allSettled(
        clusterIds.map(async (clusterId) => {
          const client = getAdapterClient(clusterId);
          if (!client) {
            throw new Error(`Cluster ${clusterId} is not found`);
          }

          const reply = await asyncClientCall(client.config, "getSummaryClusterInfo", {
            accountNames,
          });

          if (isFullDisplayMode || isFullDisplayMode === undefined) {
            return { ...reply, clusterId };
          } else {
            return {
              ...reply,
              clusterId,
              notAvailableNodeCount: undefined,
              notAvailableCpuCount: undefined,
              notAvailableGpuCount: undefined,
              partitions: reply.partitions.map((partition) => ({
                ...partition,
              })),
            };
          }
        }),
      );

      const clusters = results
        .map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            const clusterId = clusterIds[index];
            const errorMessage = result.reason?.message || "Unknown error";
            console.error(`Failed to get cluster info for ${clusterId}: ${errorMessage}`);
            return null;
          }
        })
        .filter((cluster) => cluster !== null);

      return clusters;
    }),

  // 批量获取多个集群的节点信息
  getAllClustersNodesInfo: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/dashboard/clusters/nodes",
        tags: ["dashboard"],
        summary: "Get all clusters nodes info",
      },
    })
    .input(AllClustersNodesInfoInput)
    .output(AllClustersNodesInfoSchema)
    .query(async ({ input }) => {
      const { clusterIds } = input;

      const results = await Promise.allSettled(
        clusterIds.map(async (clusterId) => {
          const client = getAdapterClient(clusterId);
          if (!client) {
            throw new Error(`Cluster ${clusterId} is not found`);
          }

          const reply = await asyncClientCall(client.config, "getClusterNodesInfo", { nodeNames: [] });

          return {
            clusterId,
            nodeInfo: reply.nodes,
          };
        }),
      );

      const clusters = results
        .map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            const clusterId = clusterIds[index];
            const errorMessage = result.reason?.message || "Unknown error";
            console.error(`Failed to get cluster nodes info for ${clusterId}: ${errorMessage}`);
            return null;
          }
        })
        .filter((cluster) => cluster !== null);

      return { clusters };
    }),

  getQuickEntries: authProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/dashboard/quick-entries",
        tags: ["dashboard"],
        summary: "Get user's quick entries",
      },
    })
    .input(z.void())
    .output(z.array(EntrySchema))
    .query(async ({ ctx: { user } }) => {
      const filePath = path.join(quickEntryPath, user.identityId, "quickEntries.json");

      let jsonObject: z.infer<typeof EntryListSchema> = [];

      try {
        const data = await fsPromises.readFile(filePath, "utf8");
        const result = EntryListSchema.safeParse(JSON.parse(data));
        if (result.success) {
          // 成功解析，使用解析后的数据
          jsonObject = result.data;
        } else {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "An error occurred while parse quickEntries.json",
          });
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;

        // 文件不存在则返回空数组
        if (err.code === "ENOENT") {
          logger.info(`Quick entries file not found for user ${user.identityId}`);
          return [];
        }

        // 其他错误则记录日志并抛出
        logger.error(`Read file failed for user ${user.identityId}: ${err.message}`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to read quick entries: ${err.message}`,
        });
      }

      // 缓存集群应用配置
      const clusterAppConfigsCache = new Map<string, Record<string, AppConfigSchema>>();

      const getCachedClusterAppConfigs = (clusterId: string) => {
        if (!clusterAppConfigsCache.has(clusterId)) {
          const configs = getClusterAppConfigs(clusterId);
          clusterAppConfigsCache.set(clusterId, configs);
        }
        return clusterAppConfigsCache.get(clusterId);
      };

      // 处理每个条目，添加应用 logo 路径
      const mappedEntries = jsonObject.map((entry) => {
        if (entry.entry?.$case === "app") {
          const { appId, clusterId } = entry.entry.app;
          const clusterApps = getCachedClusterAppConfigs(clusterId);
          const currentLogoPath = clusterApps?.[appId]?.logoPath || undefined;
          return {
            ...entry,
            entry: {
              ...entry.entry,
              app: {
                ...entry.entry.app,
                appLogoPath: currentLogoPath,
              },
            },
          };
        }
        return entry;
      });

      return mappedEntries;
    }),

  saveQuickEntries: authProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/dashboard/save-quick-entries",
        tags: ["dashboard"],
        summary: "Save user's quick entries",
      },
    })
    .input(
      z.object({
        quickEntries: z.array(EntrySchema),
      }),
    )
    .output(z.object({}))
    .mutation(async ({ input, ctx: { user } }) => {
      const { quickEntries } = input;
      const jsonContent = JSON.stringify(quickEntries);
      const filePath = path.join(quickEntryPath, user.identityId, "quickEntries.json");
      const dirPath = path.dirname(filePath);

      try {
        // 确保目录存在
        await fsPromises.mkdir(dirPath, { recursive: true });

        // 将内容写入文件
        await fsPromises.writeFile(filePath, jsonContent);

        return {};
      } catch (err) {
        const errorMessage =
          err instanceof Error && "message" in err
            ? `Error saving quick entry for user ${user.identityId}: ${err.message}`
            : "";

        logger.error("Saving file failed with %o", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errorMessage || `An error occurred while saving quick entry for user ${user.identityId}`,
          cause: err,
        });
      }
    }),
});
