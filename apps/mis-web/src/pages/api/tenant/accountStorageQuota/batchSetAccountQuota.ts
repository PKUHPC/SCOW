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

export const BatchSetAccountQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    accountNames: Type.Array(Type.String()),
    storageId: Type.String(),
    quotaMb: Type.Number(),
    useTenantDefaultAccountQuota: Type.Optional(Type.Boolean()),
  }),

  responses: {
    200: Type.Object({
      failedAccountNames: Type.Array(Type.String()),
    }),
    403: Type.Null(),
    409: Type.Object({ code: Type.Literal("RESOURCE_CONNECT_FAILED") }),
    /** 账户存储配额功能未开启 */
    412: Type.Null(),
    500: ScowErrorResponse,
  },
});

export default route(BatchSetAccountQuotaSchema, async (req, res) => {
  const { accountNames, storageId, quotaMb, useTenantDefaultAccountQuota } = req.body;

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
    operationTypeName: OperationType.batchSetAccountStorageQuota,
    operationTypePayload: { accountNames, storageId, storageQuotaMb: quotaMb },
  };

  return asyncClientCall(client, "batchSetAccountStorageQuota", {
    tenantName: info.tenant,
    accountNames,
    storageId,
    quotaMb,
    useTenantDefaultAccountQuota: useTenantDefaultAccountQuota ?? false,
  })
    .then(async (r) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { failedAccountNames: r.failedAccountNames } };
    })
    .catch(handlegRPCError({
      [Status.FAILED_PRECONDITION]: (error) => {
        const scowErrorCode = error.metadata.get("SCOW_ERROR_CODE")?.[0]?.toString();
        if (scowErrorCode) throw error;
        return { 412: null };
      },
    }, async () => await callLog(logInfo, OperationResult.FAIL)));
});
