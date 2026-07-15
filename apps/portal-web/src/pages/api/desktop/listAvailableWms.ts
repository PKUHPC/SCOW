import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

// Cannot use AvailableWm from protos
export const AvailableWm = Type.Object({
  name: Type.String(),
  wm: Type.String(),
  iconPath: Type.Optional(Type.String()),
});
export type AvailableWm = Static<typeof AvailableWm>;

export const ListAvailableWmsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      wms: Type.Array(AvailableWm),
    }),

    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),

    // 未授权集群
    403: Type.Object({ code: Type.Literal("PERMISSION_DENIED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(ListAvailableWmsSchema, async (req, res) => {
  const { cluster } = req.query;

  const clusterConfigs = await getClusterConfigFiles();
  const loginDesktopEnabled = getLoginDesktopEnabled(cluster, clusterConfigs);

  if (!loginDesktopEnabled) {
    return { 501: { code: "CLUSTER_LOGIN_DESKTOP_NOT_ENABLED" as const } };
  }

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(DesktopServiceClient);

  return await asyncUnaryCall(client, "listAvailableWms", { cluster, userId: info.identityId }).then(
    ({ wms }) => ({ 200: { wms } }),
    handlegRPCError({
      [status.PERMISSION_DENIED]: () => ({ 403: { code: "PERMISSION_DENIED" as const } }),
    }),
  );
});
