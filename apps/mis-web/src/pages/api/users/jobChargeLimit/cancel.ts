import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
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

export const CancelJobChargeLimitSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    accountName: Type.String(),
    userIds: Type.Array(Type.String()),
    unblock: Type.Optional(Type.Boolean()),
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
    // 用户不存在，或者用户没有设置限制
    404: Type.Null(),
    // userIds 或 userId 不能为空
    400: Type.Null(),
    // 有正在进行的同步账户用户时，防止与因限额取消可能发生解封用户的冲突
    409: Type.Null(),
    500: Type.Object({ message: Type.String() }),
  },
});

export default route(CancelJobChargeLimitSchema, async (req, res) => {

  const { accountName, userIds, unblock } = req.query;

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return (acccountBelonged && acccountBelonged.role !== UserRole.USER) ||
          u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(JobChargeLimitServiceClient);

  const logInfos = userIds.map((userId) => {
    return {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.accountUnsetChargeLimit,
      operationTypePayload:{
        accountName, userId,
      },
    };
  });

  return await asyncClientCall(client, "cancelJobChargeLimit", {
    tenantName: info.tenant,
    accountName, userIds,
    unblock,
  })
    .then(async (res) => {
      if (res.success) {
        logInfos.forEach(async (logInfo) => {
          await callLog(logInfo, OperationResult.SUCCESS);
        });
      } else {
        logInfos.forEach(async (logInfo) => {
          if (res.results?.find((f) => f.success)) {
            await callLog(logInfo, OperationResult.SUCCESS);
          } else {
            await callLog(logInfo, OperationResult.FAIL);
          }
        });
      }
      return { 200: res };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.INVALID_ARGUMENT]: () => ({ 400: null }),
      [Status.FAILED_PRECONDITION]: () => ({ 409: null }),
      [Status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
    },
    async () => logInfos.forEach(async (logInfo) => {
      await callLog(logInfo, OperationResult.FAIL);
    }),
    ));
});
