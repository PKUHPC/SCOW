import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const UserQuotaInfo = Type.Object({
  userId: Type.String(),
  userName: Type.String(),
  quotaBytes: Type.Number(),
  usedStorageBytes: Type.Number(),
  useDefault: Type.Boolean(),
});

export const TenantQuotaInfo = Type.Object({
  totalStorageBytes: Type.Number(),
  remainingStorageBytes: Type.Number(),
  userDefaultQuotaBytes: Type.Number(),
  totalUserCount: Type.Number(),
  usersQuotaInfo: Type.Array(UserQuotaInfo),
});

export type UserQuotaInfo = Static<typeof UserQuotaInfo>;
export type TenantQuotaInfo = Static<typeof TenantQuotaInfo>;

export const GetTenantQuotaSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({
    tenantName: Type.String(),
    cluster: Type.String(),
    path: Type.String(),
    idOrName: Type.Optional(Type.String()),
    page: Type.Number(),
    pageSize: Type.Optional(Type.Number()),
  }),

  responses: {
    200: TenantQuotaInfo,

    403: Type.Null(),

  },
});

const auth = authenticate((u) => {
  return u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
});

export default route(GetTenantQuotaSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; };

  const { tenantName, cluster, path, idOrName, page, pageSize } = req.query;

  const client = getClient(StorageServiceClient);

  return asyncUnaryCall(client, "getTenantQuota", {
    tenantName, cluster, path, idOrName, page, pageSize,
  }).then((res) => ({ 200: { ...res } }));
});
