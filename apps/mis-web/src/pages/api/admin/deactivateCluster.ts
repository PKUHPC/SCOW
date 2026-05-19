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

export const DeactivateClusterSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    clusterId: Type.String(),
    deactivationComment: Type.Optional(Type.String()),
  }),

  responses: {
    // 如果集群已经下线了，那么executed为false
    200: Type.Object({
      executed: Type.Boolean(),
    }),
    // 集群不存在
    404: Type.Null(),
  },
});

export default /* #__PURE__*/ route(DeactivateClusterSchema, async (req, res) => {
  const { clusterId, deactivationComment } = req.body;

  const auth = authenticate((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(ConfigServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deactivateCluster,
    operationTypePayload: {
      userId: "",
      clusterId, // userId不再展示 + 维持兼容性
    },
  };

  return await asyncClientCall(client, "deactivateCluster", {
    clusterId,
    deactivationComment,
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
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
