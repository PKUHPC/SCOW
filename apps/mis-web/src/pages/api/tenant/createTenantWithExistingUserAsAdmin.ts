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
import { OperationType } from "@scow/lib-operation-log";
import { TenantServiceClient } from "@scow/protos/build/server/tenant";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CreateTenantWithExistingUserAsAdminSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    tenantName: Type.String(),
    userId: Type.String(),
    userName: Type.String(),
  }),

  responses: {
    204: Type.Null(),

    /** 用户仍然维持账户关系 */
    400: Type.Object({
      code: Type.Literal("USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP"),
    }),

    /** 用户不存在 */
    404: Type.Object({
      code: Type.Literal("USER_NOT_FOUND"),
    }),

    /** 租户已经存在 */
    409: Type.Object({
      code: Type.Literal("TENANT_ALREADY_EXISTS"),
    }),
  },
});

export default /* #__PURE__*/typeboxRoute(CreateTenantWithExistingUserAsAdminSchema, async (req, res) => {

  const { tenantName, userId, userName } = req.body;

  const auth = authenticate((u) =>
    u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

  const info = await auth(req, res);

  if (!info) { return; }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createTenant,
    operationTypePayload:{
      tenantName, tenantAdmin: userId,
    },
  };

  const client = getClient(TenantServiceClient);
  return await asyncClientCall(client, "createTenantWithExistingUserAsAdmin", {
    tenantName: tenantName,
    userId: userId,
    userName: userName,

  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(handlegRPCError({
      [status.FAILED_PRECONDITION]: () => ({
        400:{
          code: "USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP" as const,
        },
      }),
      [status.NOT_FOUND]: () => ({
        404:{
          code: "USER_NOT_FOUND" as const,
        },
      }),
      [status.ALREADY_EXISTS]: () => ({
        409:{
          code: "TENANT_ALREADY_EXISTS" as const,
        },
      }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
