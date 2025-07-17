import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

import { NodeInfo } from "./getClusterNodesInfo";

export const ClusterNodesInfoResult = Type.Object({
  clusterId: Type.String(),
  nodeInfo: Type.Array(NodeInfo),
});

export type ClusterNodesInfoResult = Static<typeof ClusterNodesInfoResult>;

export const GetAllClusterNodesInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusterIds: Type.Array(Type.String()),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(ClusterNodesInfoResult),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetAllClusterNodesInfoSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) { return; }

  const { clusterIds } = req.query;

  const client = getClient(ConfigServiceClient);

  // 并行获取所有集群节点信息，失败的集群只记录日志
  const clusterNodesInfoPromises = clusterIds.map(async (clusterId) => {
    try {
      const reply = await asyncUnaryCall(client, "getClusterNodesInfo", {
        cluster: clusterId.trim(),
        nodeNames: [],
      });

      return {
        clusterId: clusterId.trim(),
        nodeInfo: reply.nodes,
      } as ClusterNodesInfoResult;
    } catch (error) {
      console.error(
        `Failed to get cluster nodes info for ${clusterId}:`, error instanceof Error ? error.message : "Unknown error",
      );
      return null;
    }
  });

  const allResults = await Promise.all(clusterNodesInfoPromises);
  const results = allResults.filter((result): result is ClusterNodesInfoResult => result !== null);

  return { 200: { results } };
});
