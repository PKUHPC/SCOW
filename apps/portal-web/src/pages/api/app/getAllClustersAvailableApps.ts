import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

import { App } from "./listAvailableApps";

export const ClusterAppsResult = Type.Object({
  clusterId: Type.String(),
  apps: Type.Array(App),
});
export type ClusterAppsResult = Static<typeof ClusterAppsResult>;

export const GetAllClustersAvailableAppsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusterIds: Type.Array(Type.String()),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(ClusterAppsResult),
    }),
  },
});

export default /* #__PURE__*/ route(GetAllClustersAvailableAppsSchema, async (req, res) => {
  const auth = authenticate(() => true);
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { clusterIds } = req.query;

  const client = getClient(AppServiceClient);

  // 并行获取所有集群的应用信息，只返回成功的结果
  const results = await Promise.allSettled(
    clusterIds.map(async (clusterId) => {
      const reply = await asyncUnaryCall(client, "listAvailableApps", {
        cluster: clusterId,
        userId: info.identityId,
      });
      return {
        clusterId: clusterId,
        apps: reply.apps,
      };
    }),
  );

  // 只返回成功获取到的集群应用信息
  const successfulResults: ClusterAppsResult[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successfulResults.push(result.value);
    } else {
      console.error(
        `failed to get cluster ${clusterIds[index]}'s available apps: `,
        result.reason instanceof Error ? result.reason.message : "Unknown error",
      );
    }
  });

  return { 200: { results: successfulResults } };
});
