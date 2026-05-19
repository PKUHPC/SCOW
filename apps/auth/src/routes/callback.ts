import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { redirectToWeb, validateCallbackHostname } from "src/auth/callback";

const QuerystringSchema = Type.Object({
  callbackUrl: Type.String(),
  token: Type.String(),
});

enum ErrorCode {
  INVALID_TOKEN = "INVALID_TOKEN",
}

const ResponsesSchema = Type.Object({
  400: Type.Object({
    code: Type.Enum(ErrorCode),
  }),
});

/**
 * 对于类似OAuth2的认证系统，登录完成后会给一个token，应用系统（即本系统）需要通过此token来请求信息
 * 对于这种系统，应该把本endpoint（/auth/public/callback）设置为回调地址
 * 并通过实现AuthProvider的validateToken的方法来完成通过token请求信息的逻辑
 * 拿到实际需要的信息后，本认证系统将会生成一个token，并将token存入redis中，将重定向到/auth/callback完成登录流程
 *
 * LDAP认证方式不会访问此URL
 *
 * 如果请求失败，则将会返回400返回值，并使用code指定错误类型
 * INVALID_TOKEN：从OAAA获得的TOKEN无效
 */
export const authCallbackRoute = fp(async (f) => {
  f.get<{
    Querystring: Static<typeof QuerystringSchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/public/callback",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      const { token, callbackUrl } = req.query;

      // validate the token
      const info = await f.auth.fetchAuthTokenInfo(token, req);

      if (!info) {
        return await rep.code(400).send({ code: ErrorCode.INVALID_TOKEN });
      }

      await validateCallbackHostname(callbackUrl, req);

      await redirectToWeb(callbackUrl, info, rep);
    },
  );
});
