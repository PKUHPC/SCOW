import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetAccountGroupStatusResponse = Type.Object({
  accountGroupInitialized: Type.String(),
  accountGroupInitConfirmed: Type.Boolean(),
});

export type GetAccountGroupStatusResponse = Static<typeof GetAccountGroupStatusResponse>;

export const GetAccountGroupStatusSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: GetAccountGroupStatusResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetAccountGroupStatusSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const client = getClient(AdminServiceClient);
  const result = await asyncClientCall(client, "getAccountGroupStatus", {});

  return {
    200: {
      accountGroupInitialized: result.accountGroupInitialized,
      accountGroupInitConfirmed: result.accountGroupInitConfirmed,
    },
  };
});
