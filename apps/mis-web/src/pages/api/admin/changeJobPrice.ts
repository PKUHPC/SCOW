import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { numberToMoney } from "@scow/lib-decimal";
import { OperationType } from "@scow/lib-operation-log";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole } from "src/models/User";
import { GetJobFilter } from "src/pages/api/job/jobInfo";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const ChangeJobPriceSchema = typeboxRouteSchema({
  method: "PATCH",

  body: Type.Object({
    ...GetJobFilter.properties,

    reason: Type.String(),
    jobIds: Type.Array(Type.Number()),
    biJobIndexs: Type.Array(Type.Number()),
    clusters: Type.Array(Type.String()),
    /**
     * @minimum 0
     */
    price: Type.Number({ minimum: 0 }),

    /** which price to change */
    target: Type.Union([Type.Literal("tenant"), Type.Literal("account")]),
  }),

  responses: {
    200: Type.Object({ count: Type.Number() }),
    /** 非租户管理员不能修改作业的账户价格；非平台管理员不能修改作业的租户价格或修改其他租户的作业价格 */
    403: Type.Null(),
    // 账户未找到或已删除，或作业未找到
    404: Type.Object({ message: Type.String() }),
    409: Type.Object({ message: Type.String() }),
  },
});

const auth = authenticate(
  (info) =>
    info.tenantRoles.includes(TenantRole.TENANT_ADMIN) || info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
);

export default route(ChangeJobPriceSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const {
    price,
    reason,
    jobIds,
    biJobIndexs,
    accountName,
    clusters,
    jobEndTimeEnd,
    jobEndTimeStart,
    jobId,
    userId,
    tenantName,
    target,
  } = req.body;

  const isPlatformAdmin = info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN);
  const isTenantAdmin = info.tenantRoles.includes(TenantRole.TENANT_ADMIN);

  if (
    (target === "account" && (!isTenantAdmin || (tenantName !== undefined && tenantName !== info.tenant))) ||
    (target === "tenant" && !isPlatformAdmin)
  ) {
    return { 403: null };
  }

  const client = getClient(JobServiceClient);
  const filterTenantName = target === "account" ? info.tenant : (tenantName ?? "");

  const money = numberToMoney(price);
  const operationTypeName = target === "tenant" ? OperationType.changeJobPlatformPrice : OperationType.changeJobPrice;

  const baseLogInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName,
  };

  const logs = (jobIds ?? []).map((jid, i) => ({
    ...baseLogInfo,
    operationTypePayload: {
      jobId: jid,
      cluster: clusters?.[i] ?? "-", // 除非直接url调用，否则不会没有cluster
      price: money,
    },
  }));

  const writeLogs = async (result: OperationResult) => {
    for (const log of logs) {
      await callLog(log, result);
    }
  };

  return await asyncClientCall(client, "changeJobPrice", {
    filter: {
      tenantName: filterTenantName,
      clusters: clusters ?? [],
      accountName,
      jobEndTimeEnd,
      jobEndTimeStart,
      jobId,
      userId,
      jobIds,
      biJobIndexs,
    },
    ...(target === "account" ? { accountPrice: money } : { tenantPrice: money }),
    ipAddress: parseIp(req) ?? "",
    operatorId: info.identityId,
    reason,
  })
    .then(async (x) => {
      await writeLogs(OperationResult.SUCCESS);
      return { 200: x };
    })
    .catch(
      handlegRPCError(
        {
          [Status.NOT_FOUND]: (e) => ({ 404: { message: e.message } }),
          [Status.FAILED_PRECONDITION]: (e) => ({ 409: { message: e.details } }),
        },
        async () => await writeLogs(OperationResult.FAIL),
      ),
    );
});
