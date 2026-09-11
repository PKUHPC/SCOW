import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole, UserRole } from "src/models/User";
import { checkNameMatch } from "src/server/checkIdNameMatch";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const AddUserToAccountSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    identityId: Type.String(),
    accountName: Type.String(),
    name: Type.String(),
  }),

  responses: {
    204: Type.Null(),

    400: Type.Object({
      code: Type.Literal("ID_NAME_NOT_MATCH"),
    }),

    401: Type.Object({
      code: Type.Literal("ID_NAME_NOT_MATCH"),
    }),

    404: Type.Object({
      code: Type.Union([
        Type.Literal("ACCOUNT_OR_TENANT_NOT_FOUND"),
        Type.Literal("USER_ALREADY_EXIST_IN_OTHER_TENANT"),
        Type.Literal("USER_NOT_FOUND"),
      ]),
    }),

    /** 用户或账户存在问题 */
    409: Type.Object({
      code: Type.Union([
        Type.Literal("ACCOUNT_OR_USER_ERROR"),
        Type.Literal("SYNC_ACCOUNT_USER_IS_RUNNING"),
        Type.Literal("QUOTA_ENABLING"),
        Type.Literal("USER_ALREADY_IN_ANOTHER_ACCOUNT"),
        Type.Literal("DIRECTORY_GROUP_ADD_FAILED"),
        Type.Literal("DIRECTORY_SERVICE_NOT_CONFIGURED"),
      ]),
      message: Type.Optional(Type.String()),
    }),

    /** 用户或账户已删除 */
    410: Type.Object({
      code: Type.Union([
        Type.Literal("USER_DELETED"),
        Type.Literal("ACCOUNT_DELETED"),
        Type.Literal("ACCOUNT_BLOCKED_BY_ADMIN"),
      ]),
    }),
  },
});

export default /* #__PURE__*/ route(AddUserToAccountSchema, async (req, res) => {
  const { identityId, accountName, name } = req.body;

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return (
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      // 账户管理员且允许账户管理员添加用户
      ((acccountBelonged && acccountBelonged.role !== UserRole.USER) &&
        publicConfig.ADD_USER_TO_ACCOUNT.accountAdmin.allowed) ||
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN)
    );
  });

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const result = await checkNameMatch(identityId, name);

  if (result === "NotFound") {
    return { 404: { code: "USER_NOT_FOUND" as const } };
  }

  if (result === "NotMatch") {
    return { 400: { code: "ID_NAME_NOT_MATCH" as const } };
  }

  // call ua service to add user
  const client = getClient(UserServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.addUserToAccount,
    operationTypePayload: {
      accountName,
      userId: identityId,
    },
  };

  return await asyncClientCall(client, "addUserToAccount", {
    tenantName: info.tenant,
    accountName,
    userId: identityId,
    isTenantAdmin: info.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    operatorId: info.identityId,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(
      handlegRPCError(
        {
          [Status.ALREADY_EXISTS]: (e) =>
            e.details === "USER_ALREADY_IN_ANOTHER_ACCOUNT"
              ? { 409: { code: "USER_ALREADY_IN_ANOTHER_ACCOUNT" as const } }
              : { 409: { code: "ACCOUNT_OR_USER_ERROR" as const, message: e.details } },
          [Status.NOT_FOUND]: (e) => {
            if (e.details === "USER_OR_TENANT_NOT_FOUND") {
              /**
               * 后端接口addUserToAccount返回USER_OR_TENANT_NOT_FOUND
               * 说明操作者的租户下的不存在要添加的这个用户
               * 该用户存不存在于scow系统中在上面的checkNameMatch函数中已通过检查
               * */

              return { 404: { code: "USER_ALREADY_EXIST_IN_OTHER_TENANT" as const } };
            } else if (e.details === "ACCOUNT_OR_TENANT_NOT_FOUND") {
              return { 404: { code: "ACCOUNT_OR_TENANT_NOT_FOUND" as const } };
            } else if (e.details === "USER_DELETED") {
              return { 410: { code: "USER_DELETED" as const } };
            } else if (e.details === "ACCOUNT_BLOCKED_BY_ADMIN") {
              return { 410: { code: "ACCOUNT_BLOCKED_BY_ADMIN" as const } };
            } else {
              return { 410: { code: "ACCOUNT_DELETED" as const } };
            }
          },
          [Status.FAILED_PRECONDITION]: (e) => {
            if (e.details === "DIRECTORY_SERVICE_NOT_CONFIGURED") {
              return { 409: { code: "DIRECTORY_SERVICE_NOT_CONFIGURED" as const } };
            }
            if (e.details === "QUOTA_ENABLING") {
              return { 409: { code: "QUOTA_ENABLING" as const } };
            }
            return { 409: { code: "SYNC_ACCOUNT_USER_IS_RUNNING" as const, message: e.details } };
          },
          [Status.INTERNAL]: (e) => ({
            409: { code: "DIRECTORY_GROUP_ADD_FAILED" as const, message: e.message },
          }),
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
