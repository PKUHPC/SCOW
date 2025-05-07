import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { TenantServiceClient } from "@scow/protos/build/server/tenant";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetTenantsSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      names: Type.Array(Type.String()),
    }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
  || info.platformRoles.includes(PlatformRole.PLATFORM_FINANCE));

export default route(GetTenantsSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(TenantServiceClient);

    const { names } = await asyncClientCall(client, "getTenants", {});

    return { 200: { names } };
  });
