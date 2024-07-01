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
import { OperationType } from "@scow/lib-operation-log";
import { redirectToAuthLogin } from "@scow/lib-web/build/routes/auth/redirectToLogin";
import { Type } from "@sinclair/typebox";
import { setTokenCookie } from "src/auth/cookie";
import { validateToken } from "src/auth/token";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const AuthCallbackSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    token: Type.String(),
    fromAuth: Type.Optional(Type.Boolean()),
  }),

  responses: {
    200: Type.Null(),
    /** the token is invalid */
    403: Type.Null(),
  },
});



export default route(AuthCallbackSchema, async (req, res) => {

  const { token, fromAuth = false } = req.query;

  // query the token and get the username
  const info = await validateToken(token);

  if (info) {
    // set token cache
    setTokenCookie({ res }, token);
    if (fromAuth) {
      const logInfo = {
        operatorUserId: info.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.login,
      };
      await callLog(logInfo, OperationResult.SUCCESS);
    }
    res.redirect(publicConfig.BASE_PATH);
  } else {
    redirectToAuthLogin(req, res, runtimeConfig.PROTOCOL, publicConfig.BASE_PATH, runtimeConfig.AUTH_EXTERNAL_URL);
  }

});
