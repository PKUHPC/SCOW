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
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AmountStrategy } from "src/models/job";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole } from "src/models/User";
import { Money } from "src/models/UserSchemaModel";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { DEFAULT_INIT_USER_ID } from "src/utils/constants";
import { queryIfInitialized } from "src/utils/init";
import { handlegRPCError, parseIp } from "src/utils/server";

export const AddBillingItemSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    // if not set, add to platform default
    tenant: Type.Optional(Type.String()),

    itemId: Type.String(),
    price: Money,
    amount: Type.String(),
    path: Type.String(),
    description: Type.Optional(Type.String()),
  }),

  responses: {
    204: Type.Null(),
    409: Type.Object({ code: Type.Literal("ITEM_ID_EXISTS") }),
    404: Type.Object({ code: Type.Literal("TENANT_NOT_FOUND") }),
    400: Type.Object({ code: Type.Literal("INVALID_AMOUNT") }),
  },
});

export default /* #__PURE__*/typeboxRoute(AddBillingItemSchema, async (req, res) => {
  const { tenant, amount, itemId, path, price, description } = req.body;

  const logInfo = {
    operatorUserId: DEFAULT_INIT_USER_ID,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: tenant ? OperationType.setTenantBilling : OperationType.setPlatformBilling,
    operationTypePayload:{
      tenantName: tenant, path, amount, price,
    },
  };

  if (await queryIfInitialized()) {
    // Platform admin can add to every tenant
    // only tenant admin can add to its own tenant
    // if tenant is undefined, no user's tenant === undefined so only platform admin can edit default price items
    const auth = authenticate((u) =>
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN)
       || (u.tenant === tenant && u.tenantRoles.includes(TenantRole.TENANT_ADMIN)),
    );
    const info = await auth(req, res);
    if (info) {
      logInfo.operatorUserId = info.identityId;
    } else {
      return;
    }
  }

  const customAmountStrategies = publicConfig.CUSTOM_AMOUNT_STRATEGIES?.map((i) => i.id) || [];
  if (![...(Object.values(AmountStrategy) as string[]), ...customAmountStrategies].includes(amount)) {
    return { 400: { code: "INVALID_AMOUNT" } as const };
  }

  const client = getClient(JobServiceClient);

  return await asyncClientCall(client, "addBillingItem", {
    tenantName: tenant, amountStrategy: amount, itemId, path, description, price,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(handlegRPCError({
      [status.ALREADY_EXISTS]: () => ({ 409: { code: "ITEM_ID_EXISTS" } } as const),
      [status.NOT_FOUND]: () => ({ 404: { code: "TENANT_NOT_FOUND" } } as const),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
