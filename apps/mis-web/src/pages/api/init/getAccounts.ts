import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { Type } from "@sinclair/typebox";
import { Account } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const InitGetAccountsSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      accounts: Type.Array(Account),
    }),

    409: Type.Object({ code: Type.Literal("ALREADY_INITIALIZED") }),
  },
});

export default route(InitGetAccountsSchema, async () => {

  const result = await queryIfInitialized();

  if (result) { return { 409: { code: "ALREADY_INITIALIZED" as const } }; }

  const client = getClient(AccountServiceClient);

  const reply = await asyncClientCall(client, "getAccounts", {
    tenantName: DEFAULT_TENANT_NAME,
  });

  return {
    200: {
      accounts: reply.results,
    },
  };

});
