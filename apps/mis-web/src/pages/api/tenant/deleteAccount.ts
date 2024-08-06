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
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const DeleteAccountSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    accountName: Type.String(),
    ownerId: Type.String(),
    comment: Type.Optional(Type.String()),
  }),

  responses: {
    204: Type.Null(),
    // 用户不存在
    404: Type.Object({ message: Type.String() }),
    // 不能移出有正在运行作业的用户，只能先封锁
    409: Type.Object({ message: Type.String() }),
    // 操作由于其他中止条件被中止
    410: Type.Null(),
  },
});

export default /* #__PURE__*/route(DeleteAccountSchema, async (req,res) => {
  const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { accountName, ownerId, comment } = req.query;

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deleteAccount,
    operationTypePayload:{
      tenantName: info.tenant, accountName, ownerId,
    },
  };

  const client = getClient(AccountServiceClient);

  return await asyncClientCall(client, "deleteAccount", {
    accountName, comment, tenantName: info.tenant,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(handlegRPCError({
      [status.NOT_FOUND]: (e) => ({ 404: { message: e.details } }),
      [status.FAILED_PRECONDITION]: (e) => ({ 409: { message: e.details } }),
      [status.ABORTED]: () => ({ 410: null }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
