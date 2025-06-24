import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { AppAuthorizationServiceClient } from "@scow/protos/build/server/app_authorization";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AppAuthTargetType,AuthorizeAction } from "src/models/app";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { DEFAULT_INIT_USER_ID } from "src/utils/constants";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const AuthorizeAppSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    clusterId: Type.String(),
    appId: Type.String(),
    appName: Type.String(),
    action: Type.Enum(AuthorizeAction),
    targetType: Type.Enum(AppAuthTargetType),
    targetName: Type.String(),
  }),

  responses: {
    200: Type.Object({
      executed: Type.Boolean(),
      reason: Type.Optional(Type.String()),
    }),
  },
});

export default route(AuthorizeAppSchema, async (req, res) => {
  const { clusterId, appId, appName, action, targetType, targetName } = req.body;

  const logInfo = {
    operatorUserId: DEFAULT_INIT_USER_ID,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: action === AuthorizeAction.UNAUTHORIZE
      ? OperationType.unauthorizeApp
      : OperationType.authorizeApp,
    operationTypePayload:{
      clusterId,
      appName,
      target: targetType === AppAuthTargetType.TENANT ?
        { $case: "tenantName", tenantName: targetName } :
        { $case: "accountName", accountName: targetName },
    },
  };

  const auth = authenticate((u) => {
    return targetType === AppAuthTargetType.TENANT ?
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) :
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN); });
  const info = await auth(req, res);
  if (info) {
    logInfo.operatorUserId = info.identityId;
  } else {
    return;
  }

  const client = getClient(AppAuthorizationServiceClient);

  return await asyncClientCall(client, "authorizeApp", {
    clusterId,
    appId,
    operatorId: logInfo.operatorUserId,
    action,
    target: targetType === AppAuthTargetType.TENANT ?
      { $case: "tenantName", tenantName: targetName } :
      { $case: "accountName", accountName: targetName },
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { executed: true } };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: (e) => ({ 200: { executed: false, reason: e.details } }),
      [Status.FAILED_PRECONDITION]: (e) => ({ 200: { executed: false, reason: e.details } }),
      [Status.INVALID_ARGUMENT]: (e) => ({ 200: { executed: false, reason: e.details } }),
      [Status.UNAVAILABLE]: (e) => ({ 200: { executed: false, reason: e.details } }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
