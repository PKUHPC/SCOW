import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { getLockedUsers } from "@scow/lib-auth";
import { getCapabilities } from "@scow/lib-auth";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { runtimeConfig } from "src/utils/config";

export const LockUsersInfo = Type.Object({
  identityId: Type.String(),
  name: Type.Optional(Type.String()),
  mail: Type.Optional(Type.String()),
  pwdAccountLockedTime: Type.Optional(Type.String()),
});

export type LockUsersInfo = Static<typeof LockUsersInfo>;

// 此API用于获取登录被锁定的用户。
// 没有权限返回undefined
export const GetLockedUsersSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({
    userId: Type.Optional(Type.String()), // 用户ID或DN，用于查询特定用户
    name: Type.Optional(Type.String()), // 用户姓名，用于查询特定用户
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(LockUsersInfo),
    }),

    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },
});


export default /* #__PURE__*/typeboxRoute(
  GetLockedUsersSchema, async (req, res) => {

    const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

    const info = await auth(req, res);

    if (!info) { return; }

    const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
    if (!ldapCapabilities.lockUser) {
      return { 501: null };
    }

    const { userId, name } = req.query;

    return await getLockedUsers(runtimeConfig.AUTH_INTERNAL_URL,
      { identityId: userId, name }, console)
      .then(async (res) => {
        return { 200: {
          results: res || [],
        } }; // 查询成功，返回用户信息
      }).catch(async (e) => {
        return { [e.status]: null }; // 服务器内部错误
      });
  });
