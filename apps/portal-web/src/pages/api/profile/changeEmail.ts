import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { HttpError } from "@scow/lib-auth";
import { libWebChangeEmail } from "@scow/lib-web/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

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

  const { userId, newEmail } = req.body;

  return await libWebChangeEmail(userId, newEmail, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN)
    .then(async () => {
      return { 204: null };
    })
    .catch(async (e) => {
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

