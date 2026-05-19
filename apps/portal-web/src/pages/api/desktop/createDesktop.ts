import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { callLog } from "src/server/operationLog";
import { checkUserAssignedClusters } from "src/utils/checkClusterIsAssgined";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export enum RemoteControlTool {
  VNC = 0, // 使用 VNC 工具
  SHADOWDESK = 1, // 使用 ShadowDesk 工具
}

export const CreateDesktopSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    loginNode: Type.String(),

    // the name of the wm
    wm: Type.String(),

    // the name of the desktop
    desktopName: Type.String(),

    remoteControlTool: Type.Union([Type.Literal("shadowdesk"), Type.Literal("vnc")]),
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
      shadowdesk: Type.Optional(Type.Object({ shadowdeskUrl: Type.String() })),
    }),

    400: Type.Object({
      code: Type.Union([Type.Literal("INVALID_WM"), Type.Literal("INVALID_CLUSTER")]),
    }),

    409: Type.Object({
      code: Type.Literal("TOO_MANY_DESKTOPS"),
    }),

    500: Type.Object({
      code: Type.Literal("INTERNAL_ERROR"),
      message: Type.String(),
    }),
    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(CreateDesktopSchema, async (req, res) => {
  const { cluster, loginNode, wm, desktopName, remoteControlTool } = req.body;

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

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createDesktop,
    operationTypePayload: {
      desktopName,
      wm,
      clusterId: cluster,
      loginNode,
    },
  };

  // 在传递参数前进行类型转换
  const adjustedRemoteControlTool =
    remoteControlTool === "shadowdesk" ? RemoteControlTool.SHADOWDESK : RemoteControlTool.VNC;

  return await asyncUnaryCall(client, "createDesktop", {
    cluster,
    loginNode,
    userId: info.identityId,
    wm,
    desktopName,
    remoteControlTool: adjustedRemoteControlTool,
  }).then(
    async ({ host, password, port, shadowdeskUrl }) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      if (remoteControlTool === "shadowdesk") {
        return { 200: { type: "shadowdesk" as const, shadowdesk: { shadowdeskUrl: shadowdeskUrl || "" } } };
      } else {
        return { 200: { type: "vnc" as const, vnc: { host, password, port } } };
      }
    },
    handlegRPCError(
      {
        [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
        [status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_WM" as const } }),
        [status.RESOURCE_EXHAUSTED]: () => ({ 409: { code: "TOO_MANY_DESKTOPS" as const } }),
        [status.INTERNAL]: (e) => ({ 500: { code: "INTERNAL_ERROR" as const, message: e.message } }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
