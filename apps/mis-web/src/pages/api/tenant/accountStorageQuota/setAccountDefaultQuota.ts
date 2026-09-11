import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getTenantStorageAccess } from "src/server/tenantStorageAccess";
import { getClient } from "src/utils/client";
import { route, ScowErrorResponse } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SetAccountDefaultQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    storageId: Type.String(),
    quotaMb: Type.Number(),
  }),

  responses: {
    200: Type.Object({
      successes: Type.Number(),
      failures: Type.Number(),
      failedAccountNames: Type.Array(Type.String()),
    }),
    400: Type.Object({ code: Type.Literal("INVALID_QUOTA_DATA") }),
    403: Type.Null(),
    409: Type.Object({ code: Type.Literal("RESOURCE_CONNECT_FAILED") }),
    500: ScowErrorResponse,
  },
});

export default route(SetAccountDefaultQuotaSchema, async (req, res) => {
  const { storageId, quotaMb } = req.body;

  const auth = authenticate((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN));
  const info = await auth(req, res);
  if (!info) { return; }

  const storageAccess = await getTenantStorageAccess(info.tenant, storageId);
  if (storageAccess === "forbidden") return { 403: null };
  if (storageAccess === "unavailable") return { 409: { code: "RESOURCE_CONNECT_FAILED" as const } };

  const client = getClient(StorageServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.setAccountDefaultStorageQuota,
    operationTypePayload: { storageId, storageQuotaMb: quotaMb },
  };

  return asyncClientCall(client, "setAccountDefaultStorageQuota", {
    tenantName: info.tenant,
    storageId,
    quotaMb,
  })
    .then(async (r) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: r };
    })
    .catch(handlegRPCError({
      [Status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_QUOTA_DATA" as const } }),
    },
      async () => { await callLog(logInfo, OperationResult.FAIL); },
    ));
});
