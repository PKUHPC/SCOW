/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { FullUserInfo, TenantRole,UserState } from "src/models/User";
import { getClient } from "src/utils/client";

export const GetTenantUsersSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      results: Type.Array(FullUserInfo),
    }),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default typeboxRoute(GetTenantUsersSchema,
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
      tenantRoles: x.tenantRoles,
      state:x.state || UserState.NORMAL,
    }));


    return { 200: { results: combined } };
  });
