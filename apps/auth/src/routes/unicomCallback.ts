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

import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { join } from "path";
import { cacheInfo } from "src/auth/cacheInfo";
import { redirectToWeb, validateCallbackHostname } from "src/auth/callback";
import { config } from "src/config/env";
import { getUnicomToken, getUnicomUserInfo } from "src/service/uincom";
import { checkUnicomUserExisted, createUser } from "src/service/user";

const QuerystringSchema = Type.Object({
  // 状态标识
  state:Type.String(),
  // 授权码
  code: Type.String(),
});

enum ErrorCode {
  INVALID_CODE = "INVALID_CODE",
  INVALID_TOKEN = "INVALID_TOKEN",
  INVALID_USER = "INVALID_USER",
}

const ResponsesSchema = Type.Object({
  400: Type.Object({
    code: Type.Enum(ErrorCode),
  }),
});

export const UnicomCallbackRoute = fp(async (f) => {
  f.get<{
    Querystring: Static<typeof QuerystringSchema>
    Responses: Static<typeof ResponsesSchema>,
  }>(
    "/public/unicomCallback",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {

      const { code, state } = req.query;

      // 获取登录成功后跳转的url
      const redirectUrl = new URL(state);
      const callback = redirectUrl.searchParams.get("callbackUrl");

      await validateCallbackHostname(callback!, req);

      // 获取联通token
      const fetchTokenUrl =
      `${config.UNICOM_AUTH_PATH}/auth/realms/${config.UNICOM_REALM}/protocol/openid-connect/token`;

      const tokenData = await getUnicomToken(fetchTokenUrl, {
        client_id: config.UNICOM_CLIENT_ID,
        client_secret: config.UNICOM_CLIENT_SECRET,
        code,
        redirect_uri: state,
      });

      if (!tokenData) {
        return await rep.code(400).send({ code: ErrorCode.INVALID_CODE });
      }

      const fetchUserInfoUrl =
      `${config.UNICOM_AUTH_PATH}/auth/realms/${config.UNICOM_REALM}/protocol/openid-connect/userinfo`;

      // 获取联通用户信息
      const userInfo = await getUnicomUserInfo(fetchUserInfoUrl, tokenData.access_token);

      if (!userInfo) {
        return await rep.code(400).send({ code: ErrorCode.INVALID_TOKEN });
      }

      // 联通用户是否启用和删除
      if (!userInfo.enabled || userInfo.deleted) {
        return await rep.code(400).send({ code: ErrorCode.INVALID_USER });
      }

      const userExisted = await checkUnicomUserExisted(userInfo.id);

      if (userExisted.target?.$case === "userExisted") {

        const info = await cacheInfo(userExisted.target.userExisted.userId, req);
        await redirectToWeb(callback!, info, rep);
      }
      else {

        await createUser(userInfo);

        const info = await cacheInfo(userInfo.phone, req);
        await redirectToWeb(callback!, info, rep);
      }

      return;
    },
  );
});
