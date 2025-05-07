import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole, TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const EditUserProfileSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    identityId: Type.String(),
    tenantName: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    organization: Type.Optional(Type.String()),
    adminComment: Type.Optional(Type.String()),
  }),

  responses: {
    /** 更改成功 */
    204: Type.Null(),

    /** 用户未找到 */
    404: Type.Null(),

    /** 修改失败 */
    500: Type.Object({ message: Type.String() }),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});


export default /* #__PURE__*/route(EditUserProfileSchema, async (req, res) => {

  const { identityId, tenantName, email, phone, adminComment, organization } = req.body;

  const auth = authenticate((info) =>
    info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      (info.platformRoles.includes(TenantRole.TENANT_ADMIN) && (tenantName === info.tenant)),
  );

  const info = await auth(req, res);

  if (!info) { return; }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.editUserProfile,
    operationTypePayload:{
      userId: identityId,
    },
  };

  const client = getClient(UserServiceClient);

  return await asyncClientCall(client, "changeUserProfile", {
    userId: identityId, email, phone, adminComment, organization,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    }).catch((err) => {
      console.log(err);
      throw err;
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.UNKNOWN]: (e) => ({ 500: { message: e.message } }),
      [Status.UNIMPLEMENTED]: () => ({ 501: null }),
    }));

});
