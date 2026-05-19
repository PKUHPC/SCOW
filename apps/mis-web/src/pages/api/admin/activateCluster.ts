import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { ConfigServiceClient } from "@scow/protos/build/server/config";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const ActivateClusterSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    clusterId: Type.String(),
  }),

  responses: {
    // 如果当前集群无法连接或者已经上线了，那么executed为false
    200: Type.Object({
      executed: Type.Boolean(),
      reason: Type.Optional(Type.String()),
    }),
    // 集群不存在
    404: Type.Null(),
  },
});

export default /* #__PURE__*/ route(ActivateClusterSchema, async (req, res) => {
  const { clusterId } = req.body;

  const auth = authenticate((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(ConfigServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.activateCluster,
    operationTypePayload: {
      userId: "",
      clusterId,
    },
  };

  return await asyncClientCall(client, "activateCluster", {
    clusterId,
    operatorId: info.identityId,
  })
    .then(async (reply) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: reply };
    })
    .catch(
      handlegRPCError(
        {
          [Status.NOT_FOUND]: () => ({ 404: null }),
          [Status.FAILED_PRECONDITION]: (e) => ({ 200: { executed: false, reason: e.details } }),
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
