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
import { OperationType } from "@scow/lib-operation-log";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { ImportUsersData } from "src/models/UserSchemaModel";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { DEFAULT_INIT_USER_ID, DEFAULT_TENANT_NAME } from "src/utils/constants";
import { queryIfInitialized } from "src/utils/init";
import { handlegRPCError, parseIp } from "src/utils/server";

export const ImportUsersSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    data: ImportUsersData,
    whitelist: Type.Boolean(),
  }),

  responses: {
    204: Type.Null(),
    400: Type.Object({ code: Type.Literal("INVALID_DATA") }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default typeboxRoute(ImportUsersSchema,
  async (req, res) => {

    const { data, whitelist } = req.body;

    const logInfo = {
      operatorUserId: DEFAULT_INIT_USER_ID,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.importUsers,
      operationTypePayload: {
        tenantName: DEFAULT_TENANT_NAME,
        importAccounts: data.accounts.map((account) => ({
          accountName: account.accountName,
          userIds: account.users.map((user) => user.userId),
        })),
      },
    };

    // if not initialized, every one can import users
    if (await queryIfInitialized()) {
      const info = await auth(req, res);
      if (info) {
        logInfo.operatorUserId = info.identityId;
      } else {
        return;
      }
    }

    const client = getClient(AdminServiceClient);

    return await asyncClientCall(client, "importUsers", {
      data, whitelist,
    })
      .then(async () => {
        await callLog(logInfo, OperationResult.SUCCESS);
        return { 204: null };
      })
      .catch(handlegRPCError({
        [Status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_DATA" } } as const),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
      ));
  });
