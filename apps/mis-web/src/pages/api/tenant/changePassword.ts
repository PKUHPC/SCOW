import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { changePassword as libChangePassword, getCapabilities } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { GetUserInfoResponse, UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

// 此API用于租户管理员修改自己租户的用户密码
// 没有权限返回undefined
export const ChangePasswordAsTenantAdminSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    identityId: Type.String(),
    /**
     *  CommonConfig.PASSWORD_PATTERN
     *  OR
     *  when CommonConfig.PASSWORD_PATTERN={} =>
     *  use default value: ^(?=.*\d)(?=.*[a-zA-Z])(?=.*[`~!@#\$%^&*()_+\-[\];',./{}|:"<>?]).{8,}$
     */
    newPassword: Type.String(),
  }),

  responses: {
    /** 更改成功 */
    204: Type.Null(),

    /** 用户未找到 */
    404: Type.Null(),

    /** 密码正则校验失败 */
    400: Type.Object({
      code: Type.Literal("PASSWORD_NOT_VALID"),
    }),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});


export default /* #__PURE__*/route(
  ChangePasswordAsTenantAdminSchema, async (req, res) => {

    if (!publicConfig.ENABLE_CHANGE_PASSWORD) {
      return { 501: null };
    }

    const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
    if (!ldapCapabilities.changePassword) {
      return { 501: null };
    }

    const { identityId, newPassword } = req.body;

    const client = getClient(UserServiceClient);
    const userInfo: GetUserInfoResponse = await asyncClientCall(client, "getUserInfo", {
      userId: identityId,
    });
    if (!userInfo) {
      return { 404: null };
    }
    // 鉴权，要求用户所在的租户应该为当前租户管理员
    const auth = authenticate((info) =>
      (info.tenantRoles.includes(TenantRole.TENANT_ADMIN)) && (userInfo.tenantName === info.tenant));

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const passwordPattern = publicConfig.PASSWORD_PATTERN && new RegExp(publicConfig.PASSWORD_PATTERN);
    if (passwordPattern && !passwordPattern.test(newPassword)) {
      return { 400: {
        code: "PASSWORD_NOT_VALID" as const,
      } };
    }

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.tenantChangePassword,
      operationTypePayload:{
        tenantName: info.tenant, userId: identityId,
      },
    };

    return await libChangePassword(runtimeConfig.AUTH_INTERNAL_URL, { identityId, newPassword }, console)
      .then(async () => {
        await callLog(logInfo, OperationResult.SUCCESS);
        return { 204: null };
      })
      .catch(async (e) => {
        await callLog(logInfo, OperationResult.FAIL);
        return { [e.status]: null };
      });
  });
