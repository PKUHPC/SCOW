import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getCapabilities } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

// 此API用于用户修改自己的邮箱。
export const ChangeEmailSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    userId: Type.String(),
    newEmail: Type.String(),
  }),

  responses: {
    /** 更改成功 */
    204: Type.Null(),

    /** 用户未找到 */
    404: Type.Null(),

    /** 修改失败 */
    500: Type.Null(),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});

export default /* #__PURE__*/route(ChangeEmailSchema, async (req, res) => {
  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.changeEmail) {
    return { 501: null };
  }

  const { userId, newEmail } = req.body;

  const client = getClient(UserServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.changeEmail,
  };

  return await asyncClientCall(client, "changeEmail", {
    userId,
    newEmail,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.UNKNOWN]: () => ({ 500: null }),
      [Status.UNIMPLEMENTED]: () => ({ 501: null }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
