import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { checkUserAssignedClusters } from "src/utils/checkClusterIsAssgined";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const LaunchDesktopSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    id: Type.Number(),
    displayId: Type.Number(),
    cluster: Type.String(),
    loginNode: Type.String(),
    desktopInfo: Type.Optional(
      Type.Object({
        desktop: Type.Union([
          Type.Object({
            $case: Type.Literal("vnc"),
            vnc: Type.Object({
              displayId: Type.Number(),
            }),
          }),
          Type.Object({
            $case: Type.Literal("shadowdesk"),
            shadowdesk: Type.Object({
              desktopName: Type.String(),
            }),
          }),
        ]),
      }),
    ),
  }),

  responses: {
    200: Type.Object({
      type: Type.Union([Type.Literal("vnc"), Type.Literal("shadowdesk")]),
      vnc: Type.Optional(
        Type.Object({
          host: Type.String(),
          port: Type.Number(),
          password: Type.String(),
        }),
      ),
      shadowdesk: Type.Optional(
        Type.Object({
          shadowdeskUrl: Type.String(),
        }),
      ),
    }),
    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),
    503: Type.Object({ code: Type.Literal("DESKTOP_NOT_AVAILABLE") }),
    // 无效集群
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
    // 无效桌面名
    404: Type.Object({ code: Type.Literal("INVALID_DESKTOP_NAME") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(LaunchDesktopSchema, async (req, res) => {
  const { id, cluster, loginNode, displayId, desktopInfo } = req.body;

  const clusterConfigs = await getClusterConfigFiles();
  const loginDesktopEnabled = getLoginDesktopEnabled(cluster, clusterConfigs);

  if (!loginDesktopEnabled) {
    return { 501: { code: "CLUSTER_LOGIN_DESKTOP_NOT_ENABLED" as const } };
  }

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  // 验证当前集群是否为用户关联账户的已授权集群
  const isClusterAssigned = await checkUserAssignedClusters(cluster, info.identityId);
  if (!isClusterAssigned) {
    return { 400: { code: "INVALID_CLUSTER" as const } };
  }

  const client = getClient(DesktopServiceClient);

  return await asyncUnaryCall(client, "connectToDesktop", {
    id,
    cluster,
    loginNode,
    displayId,
    userId: info.identityId,
    desktopInfo,
  }).then(
    async ({ host, password, port, shadowdeskUrl }) => ({
      200: {
        type: desktopInfo?.desktop.$case || "vnc",
        ...(desktopInfo?.desktop.$case === "vnc"
          ? {
              vnc: { host, port, password },
            }
          : {
              shadowdesk: { shadowdeskUrl: shadowdeskUrl || "" },
            }),
      },
    }),
    handlegRPCError({
      [status.NOT_FOUND]: (e) => ({ 404: { code: "INVALID_DESKTOP_NAME" as const, message: e.message } }),
      [status.FAILED_PRECONDITION]: (e) => ({ 503: { code: "DESKTOP_NOT_AVAILABLE" as const, message: e.message } }),
    }),
  );
});
