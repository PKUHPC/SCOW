import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { ClusterConnectionInfo, ClusterConnectionInfoSchema, ClusterConnectionStatus } from "src/models/cluster";
import { PlatformRole } from "src/models/User";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetClustersConnectionInfoSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      results: Type.Array(ClusterConnectionInfoSchema),
    }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetClustersConnectionInfoSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const configClusters = await getClusterConfigFiles();

  const clustersConnectionResp: ClusterConnectionInfo[] = [];
  const client = getClient(ConfigServiceClient);

  await Promise.allSettled(
    Object.keys(configClusters).map(async (cluster) => {
      const reply = await asyncClientCall(client, "getClusterNodesInfo", { cluster, nodeNames: [] }).catch((e) => {
        console.info("Cluster Connection Error ( Cluster ID : %s , Details: %s ) .", cluster, e);
        clustersConnectionResp.push({
          clusterId: cluster,
          connectionStatus: ClusterConnectionStatus.ERROR,
          totalNodeCount: 0,
          totalCpuCoreCount: 0,
          totalGpuCount: 0,
          totalMemMb: 0,
        });
      });

      if (reply) {
        const totalCpuCoreCount = reply.nodes.reduce((total, node) => total + node.cpuCoreCount, 0);
        const totalGpuCount = reply.nodes.reduce((total, node) => total + node.gpuCount, 0);
        const totalMemMb = reply.nodes.reduce((total, node) => total + node.totalMemMb, 0);
        clustersConnectionResp.push({
          clusterId: cluster,
          connectionStatus: ClusterConnectionStatus.AVAILABLE,
          totalNodeCount: reply.nodes.length,
          totalCpuCoreCount,
          totalGpuCount,
          totalMemMb,
        });
      }
    }),
  );

  return {
    200: { results: clustersConnectionResp },
  };
});
