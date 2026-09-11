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
    userIds: Type.Array(Type.String()),
  }),

  responses: {
    200: Type.Object({
      success: Type.Boolean(),
      results: Type.Optional(
        Type.Array(
          Type.Object({
            success: Type.Boolean(),
            userId: Type.String(),
          }),
        ),
      ),
    }),
    // 用户不存在
    404: Type.Null(),

    // 操作集群失败
    400: Type.Object({ message: Type.String() }),

    // 不能移出账户主管理员
    406: Type.Null(),

    // 不能移出有正在运行作业的用户，只能先封锁
    409: Type.Null(),
    500: Type.Object({ message: Type.String() }),
  },
});

export default /* #__PURE__*/ route(RemoveUserFromAccountSchema, async (req, res) => {
  const { userIds, accountName } = req.query;
  const uniqueUserIds = Array.from(new Set(userIds));

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return (
      u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      (acccountBelonged && acccountBelonged.role !== UserRole.USER) ||
      u.tenantRoles.includes(TenantRole.TENANT_ADMIN)
    );
  });

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  // call ua service to add user
  const client = getClient(UserServiceClient);

  const logInfos = uniqueUserIds.map((userId) => {
    return {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.removeUserFromAccount,
      operationTypePayload: {
        accountName,
        userId,
      },
    };
  });

  return await asyncClientCall(client, "removeUserFromAccount", {
    tenantName: info.tenant,
    accountName,
    userIds: uniqueUserIds,
    operatorId: info.identityId,
  })
    .then(async (res) => {
      await Promise.all(
        logInfos.map((logInfo) => {
          const userId = logInfo.operationTypePayload.userId;
          const result = res.results?.find((result) => result.userId === userId);

          return callLog(
            logInfo,
            res.success || result?.success ? OperationResult.SUCCESS : OperationResult.FAIL,
          );
        }),
      );

      return { 200: res };
    })
    .catch(
      handlegRPCError(
        {
          [Status.UNAVAILABLE]: (e) => ({ 400: { message: e.details } }),
          [Status.NOT_FOUND]: () => ({ 404: null }),
          [Status.OUT_OF_RANGE]: () => ({ 406: null }),
          [Status.FAILED_PRECONDITION]: () => ({ 409: null }),
          [Status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
        },
        async () => {
          await Promise.all(logInfos.map((logInfo) => callLog(logInfo, OperationResult.FAIL)));
        },
      ),
    );
});
