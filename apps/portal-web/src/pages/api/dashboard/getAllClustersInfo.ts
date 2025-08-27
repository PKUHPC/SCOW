import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/portal/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

import { ClusterInfo } from "./getClusterInfo";

export const ClusterInfoResult = Type.Object({
  clusterInfo: ClusterInfo,
});

export type ClusterInfoResult = Static<typeof ClusterInfoResult>;

export const GetAllClustersInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusterIds: Type.Array(Type.String()),
    isFullDisplayMode: Type.Boolean(),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(ClusterInfoResult),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetAllClustersInfoSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) { return; }

  const { clusterIds, isFullDisplayMode } = req.query;

  const client = getClient(ConfigServiceClient);

  // 并行获取所有集群信息，失败的集群只记录日志
  const clusterInfoPromises = clusterIds.map(async (clusterId) => {
    try {
      const reply = await asyncUnaryCall(client, "getClusterInfo", {
        cluster: clusterId.trim(),
      });

      if (isFullDisplayMode) {
        // 完整模式，返回所有数据
        return { clusterInfo: { ...reply, clusterId } } as ClusterInfoResult;
      } else {
        // 简化模式，过滤掉特定的字段
        const filteredReply = {
          ...reply,
          notAvailableNodeCount: undefined,
          notAvailableCpuCount: undefined,
          notAvailableGpuCount: undefined,
          partitions: reply.partitions.map((partition) => ({
            ...partition,
            notAvailableNodeCount: undefined,
            notAvailableCpuCount: undefined,
            notAvailableGpuCount: undefined,
          })),
        };
        return { clusterInfo: { ...filteredReply, clusterId } } as ClusterInfoResult;
      }

    } catch (error) {
      console.error(
        `Failed to get cluster info for ${clusterId}:`, error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  });

  const allResults = await Promise.all(clusterInfoPromises);
  const results = allResults.filter((result): result is ClusterInfoResult => result !== null);

  return { 200: { results } };
});
