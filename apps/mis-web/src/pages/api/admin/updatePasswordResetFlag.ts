import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getCapabilities, updatePasswordResetFlag } from "@scow/lib-auth";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { runtimeConfig } from "src/utils/config";

// 此API用于更改用户是否需要重置密码的标识。
export const updatePasswordFlagSchema = typeboxRouteSchema({

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
    500: Type.Null(),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});

export default /* #__PURE__*/typeboxRoute(updatePasswordFlagSchema, async (req, res) => {
  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.updatePasswordResetFlag) {
    return { 501: null };
  }

  const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

  const info = await auth(req, res);

  if (!info) { return; }

  const { userId, forceFlag } = req.body;

  return await updatePasswordResetFlag(runtimeConfig.AUTH_INTERNAL_URL, { identityId: userId, forceFlag }, console)
    .then(async () => {
      return { 204: null };
    })
    .catch(async (e) => {
      return { [e.status]: null };
    });
});
