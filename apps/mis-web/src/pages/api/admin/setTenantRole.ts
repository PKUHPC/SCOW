import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { DEFAULT_INIT_USER_ID, DEFAULT_TENANT_NAME } from "src/utils/constants";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SetTenantRoleSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    userId: Type.String(),
    roleType: Type.Enum(TenantRole),
  }),

  responses: {
    // 如果用户已经是这个角色，那么executed为false
    200: Type.Object({ executed: Type.Boolean() }),
    // 用户不存在
    404: Type.Null(),
  },
});

export default route(SetTenantRoleSchema, async (req, res) => {
  const { userId, roleType } = req.body;

  const logInfo = {
    operatorUserId: DEFAULT_INIT_USER_ID,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: roleType === TenantRole.TENANT_ADMIN
      ? OperationType.setTenantAdmin
      : OperationType.setTenantFinance,
    operationTypePayload:{
      tenantName: DEFAULT_TENANT_NAME, userId,
    },
  };

  if (await queryIfInitialized()) {
    const auth = authenticate((u) => u.tenantRoles.includes(TenantRole.TENANT_ADMIN));
    const info = await auth(req, res);
    if (info) {
      logInfo.operatorUserId = info.identityId;
      logInfo.operationTypePayload.tenantName = info.tenant;
    } else {
      return;
    }
  }



  const client = getClient(UserServiceClient);

  return await asyncClientCall(client, "setTenantRole", {
    userId,
    roleType,
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
