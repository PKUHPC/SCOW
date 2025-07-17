import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { PartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";
import { NodeInfo_NodeState } from "@scow/protos/build/portal/config";
import { TRPCError } from "@trpc/server";
import { router } from "src/server/trpc/def";
import { authProcedure } from "src/server/trpc/procedure/base";
import { getAdapterClient } from "src/server/utils/clusters";
import { z } from "zod";

// 定义分区信息
export const PartitionSchema = z.object({
  partitionName: z.string(),
  nodeCount: z.number(),
  runningNodeCount: z.number(),
  idleNodeCount: z.number(),
  notAvailableNodeCount: z.number(),
  cpuCoreCount: z.number(),
  runningCpuCount: z.number(),
  idleCpuCount: z.number(),
  notAvailableCpuCount: z.number(),
  gpuCoreCount: z.number(),
  runningGpuCount: z.number(),
  idleGpuCount: z.number(),
  notAvailableGpuCount: z.number(),
  jobCount: z.number(),
  runningJobCount: z.number(),
  pendingJobCount: z.number(),
  usageRatePercentage: z.number(),
  partitionStatus: z.nativeEnum(PartitionInfo_PartitionStatus),
});

// 定义集群信息
const ClusterInfoSchema = z.object({
  partitions: z.array(PartitionSchema), // 分区列表
});

export const NodeInfoSchema = z.object({
  nodeName: z.string(),
  partitions: z.array(z.string()),
  state: z.nativeEnum(NodeInfo_NodeState),
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
});

const AllClustersInfoSchema = z.object({
  clusters: z.array(ClusterInfoSchema.extend({
    clusterId: z.string(),
  })),
});

// 批量获取集群节点信息的输入和输出模式
const AllClustersNodesInfoInput = z.object({
  clusterIds: z.array(z.string()),
});

const AllClustersNodesInfoSchema = z.object({
  clusters: z.array(ClusterNodesInfoSchema.extend({
    clusterId: z.string(),
  })),
});


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
        method: "GET",
        path: "/dashboard/clusters",
        tags: ["dashboard"],
        summary: "Get all clusters info",
      },
    })
    .input(AllClustersInfoInput)
    .output(AllClustersInfoSchema)
    .query(async ({ input }) => {
      const { clusterIds } = input;

      const results = await Promise.allSettled(
        clusterIds.map(async (clusterId) => {
          const client = getAdapterClient(clusterId);
          if (!client) {
            throw new Error(`Cluster ${clusterId} is not found`);
          }

          const reply = await asyncClientCall(client.config, "getClusterInfo", {
            cluster: clusterId,
          });

          return {
            clusterId,
            partitions: reply.partitions,
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
            console.error(`Failed to get cluster info for ${clusterId}: ${errorMessage}`);
            return null;
          }
        })
        .filter((cluster) => cluster !== null);

      return { clusters };
    }),

  // 批量获取多个集群的节点信息
  getAllClustersNodesInfo: authProcedure
    .meta({
      openapi: {
        method: "GET",
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

          const reply = await asyncClientCall(client.config, "getClusterNodesInfo", { nodeNames: []});

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
});
