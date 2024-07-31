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

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { validateToken } from "src/auth/token";
import { getUserAssociatedClusterIds } from "src/server/userAssociatedClusterIds";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const GetUserAssociatedClusterIdsSchema = typeboxRouteSchema({

  method: "GET",

  // only set the query value when firstly used in getInitialProps
  query: Type.Object({
    userId: Type.String(),
    token: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      clusterIds: Type.Optional(Type.Array(Type.String())),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);
export default route(GetUserAssociatedClusterIdsSchema,
  async (req, res) => {
    const { userId, token } = req.query;
    // when firstly used in getInitialProps, check the token
    // when logged in, use auth()
    const info = token ? await validateToken(token) : await auth(req, res);
    if (!info) { return; }

    const reply = await libWebGetUserInfo(userId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);
    const accountNames = reply?.affiliations.map((a) => (a.accountName));
    const tenantName = reply?.tenantName;

    if (!accountNames || !tenantName) {
      return { 403: null };
    }
    const clusterIds = await getUserAssociatedClusterIds(accountNames, tenantName);

    return {
      200: {
        clusterIds : clusterIds,
      },
    };
  });
