import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { TenantServiceClient } from "@scow/protos/build/server/tenant";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { PlatformTenantsInfo } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use GetAllTenantsResponse from protos
export const GetAllTenantsResponse = Type.Object({
  totalCount: Type.Number(),
  platformTenants: Type.Array(PlatformTenantsInfo),
});
export type GetAllTenantsResponse = Static<typeof GetAllTenantsResponse>;

export const GetAllTenantsSchema = typeboxRouteSchema({
  method: "GET",
  responses: {
    200: GetAllTenantsResponse,
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));
export default route(GetAllTenantsSchema,
  async (req, res) => {
    const info = await auth(req, res);
    if (!info) {
      return;
    }
    // UserServiceClient
    const client = getClient(TenantServiceClient);
    const result = await asyncClientCall(client, "getAllTenants", {});
    return {
      200:result,
    };
  });
