import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetUsedPayTypesSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      types: Type.Array(Type.String()),
    }),
  },
});

const auth = authenticate((u) =>
  u.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
  u.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
  u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
  u.tenantRoles.includes(TenantRole.TENANT_ADMIN),
);

export default route(GetUsedPayTypesSchema,
  async (req, res) => {


    const info = await auth(req, res);

    if (!info) { return; }

    const client = getClient(ChargingServiceClient);

    const { types } = await asyncClientCall(client, "getAllPayTypes", {});

    return { 200: { types } };

  });

