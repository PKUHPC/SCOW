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

export const SetTenantUserDefaultQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    tenantName: Type.String(),
    cluster: Type.String(),
    path: Type.String(),
    userQuotaBytes: Type.Number(),
  }),

  responses: {
    200: Type.Object({
      successes: Type.Number(),
      failures: Type.Number(),
    }),


    400: Type.Null(),
  },
});

export default /* #__PURE__*/route(SetTenantUserDefaultQuotaSchema, async (req, res) => {
  const { tenantName, cluster, path, userQuotaBytes } = req.body;

  const auth = authenticate((u) => {
    return u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.setTenantUserDefaultQuota,
    operationTypePayload:{
      tenantName, cluster, path, storageQuota: userQuotaBytes,
    },
  };

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "setTenantUserDefaultQuota", {
    tenantName, cluster, path, userQuotaBytes,
  })
    .then(async (res) => {
      await callLog(logInfo, OperationResult.SUCCESS);

      return { 200: { ...res } };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 400: null }),
    }, async () => await callLog(logInfo, OperationResult.FAIL)));
});
