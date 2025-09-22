import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getCapabilities, updatePasswordResetFlag } from "@scow/lib-auth";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, TenantRole } from "src/models/User";
import { runtimeConfig } from "src/utils/config";
import { handlegRPCError } from "src/utils/server";

// 此API用于更改用户是否需要重置密码的标识。
export const UpdatePasswordResetFlagSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    userId: Type.String(),
    forceFlag: Type.Boolean(),
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

export default /* #__PURE__*/typeboxRoute(UpdatePasswordResetFlagSchema, async (req, res) => {
  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.updatePasswordResetFlag) {
    return { 501: null };
  }

  const auth = authenticate((info) => (
    info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) || info.tenantRoles.includes(TenantRole.TENANT_ADMIN)
  ));

  const info = await auth(req, res);

  if (!info) { return; }

  const { userId, forceFlag } = req.body;

  return await updatePasswordResetFlag(runtimeConfig.AUTH_INTERNAL_URL, { identityId: userId, forceFlag }, console)
    .then(async () => {
      return { 204: null };
    })
    .catch(handlegRPCError({
      [Status.NOT_FOUND]: () => ({ 404: null }),
      [Status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
      [Status.UNIMPLEMENTED]: () => ({ 501: null }),
    }));
});
