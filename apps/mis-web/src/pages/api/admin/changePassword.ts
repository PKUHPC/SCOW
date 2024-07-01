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
import { changePassword as libChangePassword, getCapabilities } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { parseIp } from "src/utils/server";

// 此API用于账户管理员修改其他任意用户的密码。
// 没有权限返回undefined
export const ChangePasswordAsPlatformAdminSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    identityId: Type.String(),
    /**
     *  CommonConfig.PASSWORD_PATTERN
     *  OR
     *  when CommonConfig.PASSWORD_PATTERN={} =>
     *  use default value: ^(?=.*\d)(?=.*[a-zA-Z])(?=.*[`~!@#\$%^&*()_+\-[\];',./{}|:"<>?]).{8,}$
     */
    newPassword: Type.String(),
  }),

  responses: {
    /** 更改成功 */
    204: Type.Null(),

    /** 用户未找到 */
    404: Type.Null(),

    /** 密码正则校验失败 */
    400: Type.Object({
      code: Type.Literal("PASSWORD_NOT_VALID"),
    }),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});


export default /* #__PURE__*/typeboxRoute(
  ChangePasswordAsPlatformAdminSchema, async (req, res) => {

    if (!publicConfig.ENABLE_CHANGE_PASSWORD) {
      return { 501: null };
    }

    const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
    if (!ldapCapabilities.changePassword) {
      return { 501: null };
    }

    const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

    const info = await auth(req, res);

    if (!info) { return; }

    const { identityId, newPassword } = req.body;

    const passwordPattern = publicConfig.PASSWORD_PATTERN && new RegExp(publicConfig.PASSWORD_PATTERN);
    if (passwordPattern && !passwordPattern.test(newPassword)) {
      return { 400: {
        code: "PASSWORD_NOT_VALID" as const,
      } };
    }

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.platformChangePassword,
      operationTypePayload:{
        userId: identityId,
      },
    };

    return await libChangePassword(runtimeConfig.AUTH_INTERNAL_URL, { identityId, newPassword }, console)
      .then(async () => {
        await callLog(logInfo, OperationResult.SUCCESS);
        return { 204: null };
      })
      .catch(async (e) => {
        await callLog(logInfo, OperationResult.FAIL);
        return { [e.status]: null };
      });

  });
