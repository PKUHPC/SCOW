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
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const RemoveUserFromAccountSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    accountName: Type.String(),
    identityId: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    // 用户不存在
    404: Type.Null(),

    // 操作集群失败
    400: Type.Object({ message: Type.String() }),

    // 不能移出账户拥有者
    406: Type.Null(),

    // 不能移出有正在运行作业的用户，只能先封锁
    409: Type.Null(),
  },
});

export default /* #__PURE__*/route(RemoveUserFromAccountSchema, async (req, res) => {
  const { identityId, accountName } = req.query;

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
          (acccountBelonged && acccountBelonged.role !== UserRole.USER) ||
          u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  // call ua service to add user
  const client = getClient(UserServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.removeUserFromAccount,
    operationTypePayload:{
      accountName, userId: identityId,
    },
  };

  return await asyncClientCall(client, "removeUserFromAccount", {
    tenantName: info.tenant,
    accountName,
    userId: identityId,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(handlegRPCError({
      [Status.INTERNAL]: (e) => ({ 400: { message: e.details } }),
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.OUT_OF_RANGE]: () => ({ 406: null }),
      [Status.FAILED_PRECONDITION]: () => ({ 409: null }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
