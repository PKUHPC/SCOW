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
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { checkNameMatch } from "src/server/checkIdNameMatch";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

// Cannot use CreateAccountResponse from protos
export const CreateAccountResponse = Type.Object({});
export type CreateAccountResponse = Static<typeof CreateAccountResponse>;

export const CreateAccountSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    /**
     * 账户名
     */
    accountName: Type.String(),
    ownerId: Type.String(),
    ownerName: Type.String(),
    comment: Type.Optional(Type.String()),
  }),

  responses: {
    200: CreateAccountResponse,
    400: Type.Object({
      code: Type.Union([
        Type.Literal("ID_NAME_NOT_MATCH"),
        Type.Literal("ACCOUNT_NAME_NOT_VALID"),
      ]),
    }),
    /** ownerId不存在 */
    404: Type.Null(),
    409: Type.Null(),
  },
});

const accountNameRegex = publicConfig.ACCOUNT_NAME_PATTERN ? new RegExp(publicConfig.ACCOUNT_NAME_PATTERN) : undefined;

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(CreateAccountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { accountName, ownerId, ownerName, comment } = req.body;

    if (accountNameRegex && !accountNameRegex.test(accountName)) {
      return { 400: {
        code: "ACCOUNT_NAME_NOT_VALID" as const,
        message: `Account name must match ${publicConfig.ACCOUNT_NAME_PATTERN}`,
      } };
    }

    // check whether id and name matches
    const result = await checkNameMatch(ownerId, ownerName);

    if (result === "NotFound") {
      return { 404: null };
    }

    if (result === "NotMatch") {
      return { 400: { code: "ID_NAME_NOT_MATCH" as const } };
    }

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createAccount,
      operationTypePayload:{
        tenantName: info.tenant, accountName, accountOwner: ownerId,
      },
    };

    const client = getClient(AccountServiceClient);

    return await asyncClientCall(client, "createAccount", {
      accountName, ownerId, comment, tenantName: info.tenant,
    })
      .then(async (x) => {
        await callLog(logInfo, OperationResult.SUCCESS);
        return { 200: x };
      })
      .catch(handlegRPCError({
        [Status.ALREADY_EXISTS]: () => ({ 409: null }),
        [Status.NOT_FOUND]: () => ({ 404: null }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
      ));
  });
