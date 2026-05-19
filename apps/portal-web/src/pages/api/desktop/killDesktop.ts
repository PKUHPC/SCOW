import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { OperationType } from "@scow/lib-operation-log";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const KillDesktopSchema = typeboxRouteSchema({
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
    204: Type.Null(),
    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(KillDesktopSchema, async (req, res) => {
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

  const client = getClient(DesktopServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deleteDesktop,
    operationTypePayload: {
      desktopId: displayId,
      loginNode: loginNode,
      clusterId: cluster,
    },
  };

  return await asyncUnaryCall(client, "killDesktop", {
    id,
    cluster,
    loginNode,
    displayId,
    userId: info.identityId,
    desktopInfo,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(async (e) => {
      await callLog(logInfo, OperationResult.FAIL);
      throw e;
    });
});
