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
import { Status } from "@grpc/grpc-js/build/src/constants";
import { numberToMoney } from "@scow/lib-decimal";
import { JobChargeLimitServiceClient } from "@scow/protos/build/server/job_charge_limit";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult, OperationType } from "src/models/operationLog";
import { TenantRole, UserRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SetJobChargeLimitSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    accountName: Type.String(),
    userId: Type.String(),
    limit: Type.Number(),
  }),

  responses: {
    204: Type.Null(),
    // 用户不存在
    404: Type.Null(),
    400: Type.Object({ code: Type.Literal("INVALID_LIMIT_DATA") }),
  },
});

export default typeboxRoute(SetJobChargeLimitSchema, async (req, res) => {

  const { accountName, userId, limit } = req.body;

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return (acccountBelonged && acccountBelonged.role !== UserRole.USER) ||
          u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(JobChargeLimitServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.accountSetChargeLimit,
    operationTypePayload:{
      accountName, userId, limit: numberToMoney(limit),
    },
  };

  return await asyncClientCall(client, "setJobChargeLimit", {
    tenantName: info.tenant,
    accountName, userId, limit: numberToMoney(limit),
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_LIMIT_DATA" as const } }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
