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
import { status } from "@grpc/grpc-js";
import { getCapabilities } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { getCurrentLanguageId } from "@scow/lib-web/build/utils/systemLanguage";
import { TenantServiceClient } from "@scow/protos/build/server/tenant";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { getUserIdRule } from "src/utils/createUser";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CreateTenantSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    tenantName: Type.String(),
    userId: Type.String(),
    userName: Type.String(),
    userEmail: Type.String(),
    userPassword: Type.String(),
  }),

  responses: {
    200: Type.Object({
      createdInAuth: Type.Boolean(),
    }),

    400: Type.Object({
      code: Type.Union([
        Type.Literal("PASSWORD_NOT_VALID"),
        Type.Literal("USERID_NOT_VALID"),
      ]),
    }),

    /** 租户已经存在 */
    409: Type.Object({
      code: Type.Union([
        Type.Literal("TENANT_ALREADY_EXISTS"),
        Type.Literal("USER_ALREADY_EXISTS"),
      ]),
      message: Type.String(),
    }),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});

const passwordPattern = publicConfig.PASSWORD_PATTERN && new RegExp(publicConfig.PASSWORD_PATTERN);

export default /* #__PURE__*/typeboxRoute(CreateTenantSchema, async (req, res) => {

  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.createUser) {
    return { 501: null };
  }

  const { tenantName, userId, userName, userEmail, userPassword } = req.body;

  const languageId = getCurrentLanguageId(req, publicConfig.SYSTEM_LANGUAGE_CONFIG);

  const userIdRule = getUserIdRule(languageId);

  const auth = authenticate((u) =>
    u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

  const info = await auth(req, res);

  if (!info) { return; }

  if (userIdRule && !userIdRule.pattern.test(userId)) {
    return { 400: { code: "USERID_NOT_VALID" as const } };
  }

  if (passwordPattern && !passwordPattern.test(userPassword)) {
    return { 400: { code: "PASSWORD_NOT_VALID" as const } };
  }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createTenant,
    operationTypePayload:{
      tenantName, tenantAdmin: userId,
    },
  };


  // create tenant on server
  const client = getClient(TenantServiceClient);
  return await asyncClientCall(client, "createTenant", {
    tenantName: tenantName,
    userId: userId,
    userName: userName,
    userEmail: userEmail,
    userPassword: userPassword,
  })
    .then(async (res) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { createdInAuth: res.createdInAuth } };
    })
    .catch(handlegRPCError({
      [status.ALREADY_EXISTS]: (e) => {
        return {
          409: e.details === "TENANT_ALREADY_EXISTS"
            ? {
              code: "TENANT_ALREADY_EXISTS" as const,
              message: `Tenant with tenantName ${tenantName} already exists`,
            }
            : { code: "USER_ALREADY_EXISTS" as const, message: `User with userId ${userId} already exists` },
        };
      },
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
