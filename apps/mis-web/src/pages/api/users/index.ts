import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { AccountUserInfo } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetAccountUsersSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    accountName: Type.String(),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(AccountUserInfo),
    }),
  },
});

export default route(GetAccountUsersSchema, async (req, res) => {

  const { accountName } = req.query;

  const auth = authenticate((u) => {
    const accountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
          (accountBelonged && accountBelonged.role !== UserRole.USER) ||
          u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(UserServiceClient);

  const reply = await asyncClientCall(client, "getAccountUsers", {
    tenantName: info.tenant,
    accountName,
  });

  return {
    200: {
      results: reply.results,
    },
  };

});
