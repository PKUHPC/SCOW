import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { getCapabilities } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const DeleteUserSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    userId: Type.String(),
    userName: Type.String(),
    comments: Type.Optional(Type.String()),
  }),

  responses: {
    204: Type.Null(),
    // 用户不存在
    404: Type.Object({ message: Type.String() }),
    // 不能移出有正在运行作业的用户，只能先封锁
    409: Type.Object({ message: Type.String() }),
    // ldap禁止用户登录失败
    500: Type.Object({ message: Type.String() }),
    /** 本功能在当前配置下不可用 */
    501: Type.Object({ message: Type.String() }),
  },
});

export default /* #__PURE__*/ route(DeleteUserSchema, async (req, res) => {
  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.deleteUser) {
    return { 501: { message: "No permission to delete user in LDAP." } };
  }

  const { userId, comments } = req.query;

  const auth = authenticate(
    (u) =>
      (u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) || u.tenantRoles.includes(TenantRole.TENANT_ADMIN)) &&
      u.identityId !== userId,
  );

  const info = await auth(req, res);
  if (!info) {
    return;
  }

  // call ua service to add user
  const client = getClient(UserServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deleteUser,
    operationTypePayload: {
      userId,
    },
  };

  return await asyncClientCall(client, "deleteUser", {
    tenantName: info.tenant,
    userId,
    deletionComment: comments,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(
      handlegRPCError(
        {
          [status.NOT_FOUND]: (e) => ({ 404: { message: e.details } }),
          [status.FAILED_PRECONDITION]: (e) =>
            e.details === "DIRECTORY_SERVICE_NOT_CONFIGURED"
              ? { 500: { message: e.details } }
              : { 409: { message: e.details } },
          [status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
          [status.UNIMPLEMENTED]: (e) => ({ 501: { message: e.details } }),
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
