
import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { FullUserInfo, TenantRole,UserState } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetTenantUsersSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      results: Type.Array(FullUserInfo),
    }),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(GetTenantUsersSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const client = getClient(UserServiceClient);
    const { users } = await asyncClientCall(client, "getUsers", {
      tenantName: info.tenant,
    });

    // aggregate the result
    const combined: FullUserInfo[] = users.map((x) => ({
      accountAffiliations: x.accountAffiliations,
      createTime: x.createTime || "",
      email: x.email,
      id: x.userId,
      name: x.name,
      tenant: x.tenantName,
      phone: x.phone,
      organization: x.organization,
      adminComment: x.adminComment,
      tenantRoles: x.tenantRoles,
      state:x.state || UserState.NORMAL,
      platformRoles: x.platformRoles,
    }));


    return { 200: { results: combined } };
  });
