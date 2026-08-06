import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { numberToMoney } from "@scow/lib-decimal";
import { OperationType } from "@scow/lib-operation-log";
import { JobChargeLimitServiceClient } from "@scow/protos/build/server/job_charge_limit";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { TenantRole, UserRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SetJobChargeLimitSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    accountName: Type.String(),
    userIds: Type.Array(Type.String()),
    limit: Type.Number(),
  }),

  responses: {
    200: Type.Object({
      success: Type.Boolean(),
      results: Type.Array(
        Type.Object({
          success: Type.Boolean(),
          userId: Type.String(),
        }),
      ),
    }),
    // 用户不存在
    404: Type.Null(),
    400: Type.Object({ code: Type.Literal("INVALID_LIMIT_DATA") }),
    // 有正在进行的同步账户用户时，防止与因限额改变可能发生封锁用户或解封用户的冲突
    409: Type.Null(),
    500: Type.Object({ message: Type.String() }),
  },
});

export default route(SetJobChargeLimitSchema, async (req, res) => {
  const { accountName, userIds, limit } = req.body;
  const uniqueUserIds = Array.from(new Set(userIds));

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return (
      (acccountBelonged && acccountBelonged.role !== UserRole.USER) || u.tenantRoles.includes(TenantRole.TENANT_ADMIN)
    );
  });

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(JobChargeLimitServiceClient);

  const logInfos = uniqueUserIds.map((userId) => {
    return {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.accountSetChargeLimit,
      operationTypePayload: {
        accountName,
        userId,
        limit: numberToMoney(limit),
      },
    };
  });

  return await asyncClientCall(client, "setJobChargeLimit", {
    tenantName: info.tenant,
    accountName,
    userIds: uniqueUserIds,
    limit: numberToMoney(limit),
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
          [Status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_LIMIT_DATA" as const } }),
          [Status.FAILED_PRECONDITION]: () => ({ 409: null }),
          [Status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
        },
        async () => {
          await Promise.all(logInfos.map((logInfo) => callLog(logInfo, OperationResult.FAIL)));
        },
      ),
    );
});
