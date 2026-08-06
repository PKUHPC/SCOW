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

export const BlockUserInAccountSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    accountName: Type.String(),
    userIds: Type.Array(Type.String()),
  }),

  responses: {
    200: Type.Object({
      reason: Type.Optional(Type.String()),
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
    // userIds 或 userId 不能为空
    400: Type.Null(),
    500: Type.Object({ message: Type.String() }),
  },
});

export default /* #__PURE__*/ route(BlockUserInAccountSchema, async (req, res) => {
  const { userIds, accountName } = req.body;
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

  // 检查操作者是否已经被Block，若果是直接返回

  if (!info) {
    return;
  }

  const client = getClient(UserServiceClient);

  const logInfos = uniqueUserIds.map((userId) => {
    return {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.blockUser,
      operationTypePayload: {
        accountName,
        userId,
      },
    };
  });

  return await asyncClientCall(client, "blockUserInAccount", {
    tenantName: info.tenant,
    accountName,
    userIds: uniqueUserIds,
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
          [Status.NOT_FOUND]: () => ({ 404: null }),
          [Status.INVALID_ARGUMENT]: () => ({ 400: null }),
          [Status.FAILED_PRECONDITION]: (e) => ({ 200: { success: false, reason: e.details } }),
          [Status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
        },
        async () => {
          await Promise.all(logInfos.map((logInfo) => callLog(logInfo, OperationResult.FAIL)));
        },
      ),
    );
});
