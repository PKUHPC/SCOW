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

export const SetAdminSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    accountName: Type.String(),
    identityId: Type.String(),
  }),

  responses: {
    // 如果用户已经为管理员，那么executed为false
    200: Type.Object({ executed: Type.Boolean() }),
    // 用户不在账户中
    404: Type.Null(),
  },
});

export default /* #__PURE__*/route(SetAdminSchema, async (req, res) => {
  const { identityId, accountName } = req.body;

  const auth = authenticate((u) => {
    const acccountBelonged = u.accountAffiliations.find((x) => x.accountName === accountName);

    return u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
          (acccountBelonged && acccountBelonged.role !== UserRole.USER) ||
          u.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(UserServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.setAccountAdmin,
    operationTypePayload:{
      accountName, userId: identityId,
    },
  };

  return await asyncClientCall(client, "setAsAdmin", {
    tenantName: info.tenant,
    accountName,
    userId: identityId,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { executed: true } };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.FAILED_PRECONDITION]: () => ({ 200: { executed: false } }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
