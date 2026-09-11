import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
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
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";
import { isAccountUserSyncRunningDetails } from "src/utils/syncAccountUser";

export const ImportUsersSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    data: ImportUsersData,
    whitelist: Type.Boolean(),
  }),

  responses: {
    204: Type.Null(),
    400: Type.Object({ code: Type.Literal("INVALID_DATA") }),
    409: Type.Object({
      code: Type.Union([
        Type.Literal("SYNC_RUNNING"),
        Type.Literal("FAILED_PRECONDITION"),
        Type.Literal("QUOTA_ENABLING"),
        Type.Literal("MULTI_ACCOUNT_USERS"),
        Type.Literal("MULTI_GROUP_USERS"),
        Type.Literal("DEFAULT_GROUP_NOT_REMOVED"),
      ]),
      targets: Type.Optional(Type.String()),
      message: Type.Optional(Type.String()),
    }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(ImportUsersSchema, async (req, res) => {
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
    data,
    whitelist,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(
      handlegRPCError(
        {
          [Status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_DATA" } }) as const,
          [Status.FAILED_PRECONDITION]: (e) => {
            if (e.details === "QUOTA_ENABLING") return { 409: { code: "QUOTA_ENABLING" as const } };
            if (e.details?.startsWith("MULTI_ACCOUNT_USERS:")) {
              return {
                409: {
                  code: "MULTI_ACCOUNT_USERS" as const,
                  targets: e.details.slice("MULTI_ACCOUNT_USERS:".length),
                },
              };
            }
            if (e.details?.startsWith("MULTI_GROUP_USERS:")) {
              return {
                409: {
                  code: "MULTI_GROUP_USERS" as const,
                  targets: e.details.slice("MULTI_GROUP_USERS:".length),
                },
              };
            }
            if (e.details?.startsWith("DEFAULT_GROUP_NOT_REMOVED:")) {
              return {
                409: {
                  code: "DEFAULT_GROUP_NOT_REMOVED" as const,
                  targets: e.details.slice("DEFAULT_GROUP_NOT_REMOVED:".length),
                },
              };
            }
            if (isAccountUserSyncRunningDetails(e.details)) {
              return { 409: { code: "SYNC_RUNNING" as const } };
            }
            return {
              409: {
                code: "FAILED_PRECONDITION" as const,
                message: e.details || e.message || "Error occurred.",
              },
            };
          },
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
