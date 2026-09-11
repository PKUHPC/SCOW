import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const AccountStorageQuotaStateType = Type.Union([
  Type.Literal("DISABLED"),
  Type.Literal("ENABLING"),
  Type.Literal("ENABLED"),
]);

export const GetAccountStorageQuotaStateSchema = typeboxRouteSchema({
  method: "GET",
  responses: {
    200: Type.Object({
      state: AccountStorageQuotaStateType,
      confirmed: Type.Boolean(),
    }),
  },
});

const auth = authenticate((info) =>
  info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) || info.tenantRoles.includes(TenantRole.TENANT_ADMIN),
);

export default route(GetAccountStorageQuotaStateSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "getAccountStorageQuotaState", {})
    .then(({ state, confirmed }) => {
      const stateMap: Record<number, "DISABLED" | "ENABLING" | "ENABLED"> = {
        1: "DISABLED",
        2: "ENABLING",
        3: "ENABLED",
      };
      return { 200: { state: stateMap[state] ?? "DISABLED", confirmed } };
    });
});
