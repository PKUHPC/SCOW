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
import { moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import { OperationType } from "@scow/lib-operation-log";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";


export const TenantFinancePaySchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    amount: Type.Number(),
    tenantName: Type.String(),
    comment: Type.Optional(Type.String()),
    type: Type.String(),
  }),

  responses: {
    200: Type.Object({
      balance: Type.Number(),
    }),
    // tenant is not found in platform.
    404: Type.Null(),

  },
});

const auth = authenticate((info) =>
  info.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
  info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(TenantFinancePaySchema,
  async (req, res) => {
    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(ChargingServiceClient);

    const { tenantName, comment, amount, type } = req.body;

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.tenantPay,
      operationTypePayload:{
        tenantName: info.tenant,
        amount: numberToMoney(amount),
      },
    };
    return await asyncClientCall(client, "pay", {
      tenantName: tenantName,
      comment: comment ?? "",
      amount: numberToMoney(amount),
      operatorId: info.identityId,
      ipAddress: parseIp(req) ?? "",
      type: type,
    }).then(async (reply) => {
      const replyObj = ensureNotUndefined(reply, ["currentBalance"]);
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { balance: moneyToNumber(replyObj.currentBalance) } };
    }).catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
  },
);
