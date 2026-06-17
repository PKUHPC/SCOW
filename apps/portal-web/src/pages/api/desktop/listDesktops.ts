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
  method: "POST",

  body: Type.Object({
    clusters: Type.Array(
      Type.Object({
        cluster: Type.String(),
        loginNodes: Type.Array(Type.String()),
      }),
    ),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(
        Type.Object({
          clusterId: Type.String(),
          userDesktops: Type.Optional(
            Type.Array(
              Type.Object({
                host: Type.String(),
                desktops: Type.Array(
                  Type.Object({
                    type: Type.Union([Type.Literal("vnc"), Type.Literal("shadowdesk")]),
                    data: Type.Optional(
                      Type.Object({
                        id: Type.Number(),
                        displayId: Type.Number(),
                        desktopName: Type.String(),
                        wm: Type.String(),
                        iconPath: Type.Optional(Type.String()),
                        createTime: Type.Optional(Type.String()),
                        isActive: Type.Optional(Type.Boolean()),
                      }),
                    ),
                  }),
                ),
              }),
            ),
          ),
        }),
      ),
    }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(ListDesktopsSchema, async (req, res) => {
  const { clusters } = req.body;
  const clusterRequestMap = new Map<string, string[]>();
  clusters.forEach(({ cluster, loginNodes }) => {
    const clusterId = cluster.trim();
    if (!clusterId) {
      return;
    }

    const normalizedLoginNodes = Array.from(
      new Set(loginNodes.map((loginNode) => loginNode.trim()).filter((loginNode) => loginNode)),
    );
    const existingLoginNodes = clusterRequestMap.get(clusterId);
    if (!existingLoginNodes) {
      clusterRequestMap.set(clusterId, normalizedLoginNodes);
      return;
    }
    if (existingLoginNodes.length === 0 || normalizedLoginNodes.length === 0) {
      clusterRequestMap.set(clusterId, []);
      return;
    }

    clusterRequestMap.set(clusterId, Array.from(new Set([...existingLoginNodes, ...normalizedLoginNodes])));
  });

  const clusterRequests = Array.from(clusterRequestMap.entries()).map(([cluster, loginNodes]) => {
    return { cluster, loginNodes };
  });
  const clusterIds = clusterRequests.map(({ cluster }) => cluster);

  const clusterConfigs = await getClusterConfigFiles();

  const enabledClusterIds = clusterIds.filter((cluster) => getLoginDesktopEnabled(cluster, clusterConfigs));

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const enabledClusterIdSet = new Set(enabledClusterIds);
  const enabledClusterRequests = clusterRequests.filter(({ cluster }) => enabledClusterIdSet.has(cluster));
  const { userDesktops } =
    enabledClusterRequests.length > 0
      ? await asyncUnaryCall(getClient(DesktopServiceClient), "listUserDesktops", {
          clusters: enabledClusterRequests,
          userId: info.identityId,
        })
      : { userDesktops: [] };

  const results = clusterIds.map((clusterId) => {
    if (!enabledClusterIdSet.has(clusterId)) {
      return { clusterId };
    }

    const clusterUserDesktops = userDesktops.filter((userDesktop) => userDesktop.cluster === clusterId);

    return {
      clusterId,
      userDesktops: clusterUserDesktops.map((userDesktop) => ({
        host: userDesktop.host,
        desktops: userDesktop.desktops?.map((desktop) => {
          return {
            type:
              desktop.remoteControlTool === RemoteControlTool.SHADOWDESK ? ("shadowdesk" as const) : ("vnc" as const),
            data: {
              // scowd 模式下返回的数据一定包含 id
              id: desktop.id || desktop.displayId,
              displayId: desktop.displayId,
              desktopName: desktop.desktopName,
              wm: desktop.wm,
              iconPath: desktop.iconPath,
              isActive: desktop.isActive,
              createTime: desktop.createTime,
            },
          };
        }),
      })),
    };
  });

  return {
    200: {
      results,
    },
  };
});
