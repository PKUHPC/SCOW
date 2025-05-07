import { Type, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { changePassword as libChangePassword, getCapabilities, HttpError } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const ChangePasswordSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    newPassword: Type.String(),
  }),

  responses: {
    /** 更改成功 */
    204: Type.Null(),

    400: Type.Object({
      // 密码不合规则
      code: Type.Literal("PASSWORD_NOT_VALID"),
    }),

    /** 用户未找到 */
    404: Type.Null(),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});


const passwordPattern = publicConfig.PASSWORD_PATTERN && new RegExp(publicConfig.PASSWORD_PATTERN);

export default route(ChangePasswordSchema, async (req, res) => {

  if (!publicConfig.ENABLE_CHANGE_PASSWORD) {
    return { 501: null };
  }

  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.changePassword) {
    return { 501: null };
  }

  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const { newPassword } = req.body;

  if (passwordPattern && !passwordPattern.test(newPassword)) {
    return { 400: {
      code: "PASSWORD_NOT_VALID" as const,
    } };
  }

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.changePassword,
  };

  return await libChangePassword(runtimeConfig.AUTH_INTERNAL_URL, {
    identityId: info.identityId,
    newPassword,
  }, console)
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(async (e) => {
      await callLog(logInfo, OperationResult.FAIL);

      if (e instanceof HttpError) {
        switch (e.status) {
          case 404:
            return { 404: null };
          case 501:
            return { 501: null };
          default:
            throw e;
        }

      } else {
        throw e;
      }

    });


});
