import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { WhitelistedAccount } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetWhitelistedAccountsSchema = typeboxRouteSchema({
  method: "GET",

  responses:{
    200: Type.Object({
      results: Type.Array(WhitelistedAccount),
    }),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(GetWhitelistedAccountsSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(AccountServiceClient);

    const reply = await asyncClientCall(client, "getWhitelistedAccounts", {
      tenantName: info.tenant,
    });

    return { 200: {
      results: reply.accounts.map((x) => ({ ...x })),
    } };
  });
