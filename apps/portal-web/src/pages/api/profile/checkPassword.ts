import { HttpError, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { checkPassword as libCheckPassword, getCapabilities } from "@scow/lib-auth";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const CheckPasswordSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({ password: Type.String() }),

  responses: {
    /** 返回检查的结果 */
    200: Type.Object({
      success: Type.Boolean(),
    }),
    /** 用户不存在 */
    404: Type.Null(),
    /** 本功能在当前配置下不可用。 */
    501: Type.Null(),
  },

});

export default route(CheckPasswordSchema, async (req, res) => {
  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const ldapCapabilities = await getCapabilities(runtimeConfig.AUTH_INTERNAL_URL);
  if (!ldapCapabilities.checkPassword) {
    return { 501: null };
  }

  const { password } = req.query;

  return await libCheckPassword(runtimeConfig.AUTH_INTERNAL_URL, {
    identityId: info.identityId,
    password: password,
  }, console)
    .then((result) => {
      if (!result) {
        return { 404: null };
      }
      else {
        return { 200: { success: result.success } };
      }
    })
    .catch(async (e) => {

      if (e instanceof HttpError) {
        switch (e.status) {
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
