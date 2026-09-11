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
import { route, ScowErrorResponse } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";
import { isAccountUserSyncRunningDetails } from "src/utils/syncAccountUser";

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
      code: Type.Union([Type.Literal("ID_NAME_NOT_MATCH"), Type.Literal("ACCOUNT_NAME_NOT_VALID")]),
    }),
    /** ownerId不存在 */
    404: Type.Null(),
    409: Type.Object({
      code: Type.Union([
        Type.Literal("ALREADY_EXISTS"),
        Type.Literal("SYNC_ACCOUNT_USER_IS_RUNNING"),
        Type.Literal("FAILED_PRECONDITION"),
        Type.Literal("OWNER_ALREADY_IN_ANOTHER_ACCOUNT"),
        Type.Literal("DIRECTORY_GROUP_ALREADY_EXISTS"),
        Type.Literal("DIRECTORY_SERVICE_NOT_CONFIGURED"),
      ]),
      message: Type.Optional(Type.String()),
    }),
    401: Type.Object({ message: Type.String() }),
    500: ScowErrorResponse,
  },
});

const accountNameRegex = publicConfig.ACCOUNT_NAME_PATTERN ? new RegExp(publicConfig.ACCOUNT_NAME_PATTERN) : undefined;

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(CreateAccountSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { accountName, ownerId, ownerName, comment } = req.body;

  if (accountNameRegex && !accountNameRegex.test(accountName)) {
    return {
      400: {
        code: "ACCOUNT_NAME_NOT_VALID" as const,
        message: `Account name must match ${publicConfig.ACCOUNT_NAME_PATTERN}`,
      },
    };
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
    operationTypePayload: {
      tenantName: "",
      accountName,
      accountOwner: ownerId,
    },
  };

  const client = getClient(AccountServiceClient);

  return await asyncClientCall(client, "createAccount", {
    accountName,
    ownerId,
    comment,
    tenantName: info.tenant,
  })
    .then(async (x) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: x };
    })
    .catch(
      handlegRPCError(
        {
          [Status.ALREADY_EXISTS]: (e) =>
            e.details === "DIRECTORY_GROUP_ALREADY_EXISTS"
              ? { 409: { code: "DIRECTORY_GROUP_ALREADY_EXISTS" as const } }
              : { 409: { code: "ALREADY_EXISTS" as const } },
          [Status.NOT_FOUND]: () => ({ 404: null }),
          [Status.UNAUTHENTICATED]: (e) => ({ 401: { message: e.details } }),
          [Status.FAILED_PRECONDITION]: (e) => {
            if (isAccountUserSyncRunningDetails(e.details)) {
              return {
                409: {
                  code: "SYNC_ACCOUNT_USER_IS_RUNNING" as const,
                  message: e.details || e.message || "Error occurred.",
                },
              };
            }
            if (e.details === "DIRECTORY_SERVICE_NOT_CONFIGURED")
              return { 409: { code: "DIRECTORY_SERVICE_NOT_CONFIGURED" as const } };
            if (e.details === "OWNER_ALREADY_IN_ANOTHER_ACCOUNT")
              return { 409: { code: "OWNER_ALREADY_IN_ANOTHER_ACCOUNT" as const } };
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
