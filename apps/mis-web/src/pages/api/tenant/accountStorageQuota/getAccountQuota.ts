import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getTenantStorageAccess } from "src/server/tenantStorageAccess";
import { getClient } from "src/utils/client";
import { route, ScowErrorResponse } from "src/utils/route";

export const AccountQuotaInfo = Type.Object({
  accountName: Type.String(),
  ownerId: Type.String(),
  ownerName: Type.String(),
  quotaMb: Type.Number(),
  usedStorageMb: Type.Number(),
  useDefault: Type.Boolean(),
});

export const GetAccountQuotaSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    storageId: Type.String(),
    accountName: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      totalStorageMb: Type.Number(),
      remainingStorageMb: Type.Number(),
      accountDefaultQuotaMb: Type.Number(),
      mountedClusters: Type.Array(Type.String()),
      accountsQuotaInfo: Type.Array(AccountQuotaInfo),
    }),
    403: Type.Null(),
    409: Type.Object({ code: Type.Literal("RESOURCE_CONNECT_FAILED") }),
    500: ScowErrorResponse,
  },
});

export default route(GetAccountQuotaSchema, async (req, res) => {
  const { storageId, accountName } = req.query;

  const auth = authenticate((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN));
  const info = await auth(req, res);
  if (!info) { return; }

  const storageAccess = await getTenantStorageAccess(info.tenant, storageId);
  if (storageAccess === "forbidden") return { 403: null };
  if (storageAccess === "unavailable") return { 409: { code: "RESOURCE_CONNECT_FAILED" as const } };

  const client = getClient(StorageServiceClient);

  return asyncClientCall(client, "getAccountQuota", {
    tenantName: info.tenant,
    storageId,
    accountName: accountName || undefined,
  }).then((r) => ({
    200: {
      totalStorageMb: Number(r.totalStorageMb),
      remainingStorageMb: Number(r.remainingStorageMb),
      accountDefaultQuotaMb: Number(r.accountDefaultQuotaMb),
      mountedClusters: r.mountedClusters,
      accountsQuotaInfo: r.accountsQuotaInfo.map((a) => ({
        accountName: a.accountName,
        ownerId: a.ownerId,
        ownerName: a.ownerName,
        quotaMb: Number(a.quotaMb),
        usedStorageMb: Number(a.usedStorageMb),
        useDefault: a.useDefault,
      })),
    },
  }));
});
