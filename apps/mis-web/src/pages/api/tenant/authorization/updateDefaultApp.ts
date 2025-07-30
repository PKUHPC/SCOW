import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { AppAuthorizationServiceClient } from "@scow/protos/build/server/app_authorization";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { UpdateDefaultAppAction } from "src/models/app";
import { OperationResult } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";


export const UpdateDefaultAppSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    clusterId: Type.String(),
    appId: Type.String(),
    appName: Type.String(),
    updateAction: Type.Enum(UpdateDefaultAppAction),
  }),


  responses: {
    200: Type.Object({
      executed: Type.Boolean(),
      reason: Type.Optional(Type.String()),
    }),
  },

});

export default route(UpdateDefaultAppSchema, async (req, res) => {
  const { clusterId, appId, appName, updateAction } = req.body;

  const auth = authenticate((info) => {
    return info.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);
  if (!info) { return; }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: updateAction === UpdateDefaultAppAction.ADD_TO_DEFAULT_APPS
      ? OperationType.addToDefaultApps
      : OperationType.removeFromDefaultApps,
    operationTypePayload:{
      clusterId,
      appName,
      tenantName: info.tenant,
    },
  };

  const client = getClient(AppAuthorizationServiceClient);

  return await asyncUnaryCall(client, "updateDefaultApp", {
    clusterId,
    tenantName: info.tenant,
    appId,
    updateAction,
    operatorId: info.identityId,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { executed: true } };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: (e) => ({ 200: { executed: false, reason: e.message } }),
      [Status.FAILED_PRECONDITION]: (e) => ({ 200: { executed: false, reason: e.message } }),
      [Status.ALREADY_EXISTS]: (e) => ({ 200: { executed: false, reason: e.message } }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
