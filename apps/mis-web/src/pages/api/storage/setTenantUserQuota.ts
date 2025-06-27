import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SetTenantUserQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    userId: Type.String(),
    userQuotaBytes: Type.Optional(Type.Number()),
    useTenantDefaultUserQuota: Type.Optional(Type.Boolean()),
  }),

  responses: {
    200: Type.Object({}),

    304: Type.Null(),

    400: Type.Null(),
  },
});

export default /* #__PURE__*/route(SetTenantUserQuotaSchema, async (req, res) => {
  const { cluster, path, userId, userQuotaBytes, useTenantDefaultUserQuota } = req.body;


  const auth = authenticate((u) => {
    return u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.setTenantUserQuota,
    operationTypePayload:{
      userId, cluster, path, storageQuota: userQuotaBytes, useTenantDefaultUserQuota,
    },
  };

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "setTenantUserQuota", {
    cluster, path, userId, userQuotaBytes, useTenantDefaultUserQuota,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);

      return { 200: {} };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 400: null }),
      [Status.ALREADY_EXISTS]: () => ({ 304: null }),
    }, async () => await callLog(logInfo, OperationResult.SUCCESS)));
});
