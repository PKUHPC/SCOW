import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";

export const ListDesktopsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    loginNode: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      userDesktops: Type.Array(Type.Object({
        host: Type.String(),
        desktops: Type.Array(Type.Object({
          type: Type.Union([Type.Literal("vnc"), Type.Literal("shadowdesk")]),
          data: Type.Optional(Type.Object({
            id: Type.Number(),
            displayId: Type.Number(),
            desktopName: Type.String(),
            wm: Type.String(),
            createTime: Type.Optional(Type.String()),
            isActive: Type.Optional(Type.Boolean()),
          })),
        })),
      })),
    }),

    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(ListDesktopsSchema, async (req, res) => {

  const { cluster, loginNode } = req.query;

  const clusterConfigs = await getClusterConfigFiles();

  const loginDesktopEnabled = getLoginDesktopEnabled(cluster, clusterConfigs);
  if (!loginDesktopEnabled) {
    return { 501: { code: "CLUSTER_LOGIN_DESKTOP_NOT_ENABLED" as const } };
  }

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(DesktopServiceClient);

  const { userDesktops } = await asyncUnaryCall(client, "listUserDesktops", {
    cluster, loginNode, userId: info.identityId,
  });

  return {
    200: {
      userDesktops: userDesktops.map((userDesktop) => ({
        host: userDesktop.host,
        desktops: userDesktop.desktops?.map((desktop) => {
          return {
            type: desktop.remoteControlTool === RemoteControlTool.SHADOWDESK
              ? "shadowdesk" as const : "vnc" as const,
            data: {
              // scowd 模式下返回的数据一定包含 id
              id: desktop.id || desktop.displayId,
              displayId: desktop.displayId,
              desktopName: desktop.desktopName,
              wm: desktop.wm,
              isActive: desktop.isActive,
              createTime: desktop.createTime,
            },
          };
        }),
      })),
    },
  };

});
