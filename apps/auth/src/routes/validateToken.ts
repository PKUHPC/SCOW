import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { authConfig } from "src/config/auth";

const QuerystringSchema = Type.Object({
  token: Type.String(),
});

enum ErrorCode {
  INVALID_TOKEN = "INVALID_TOKEN",
}

const ResponsesSchema = Type.Object({
  200: Type.Object({
    identityId: Type.String({ description: "用户ID" }),
  }),
  400: Type.Object({
    code: Type.Enum(ErrorCode),
  }),
});

/**
 * 验证一个token，并获得redis中token对应的用户。
 * 如果认证有效，则返回一个UserInfo
 * 前端系统不应该直接访问redis获得用户信息，而应该通过本URL获取token对应的用户信息
 *
 * 如果token无效，则将会返回400返回值，并使用code指定错误类型
 */
export const validateTokenRoute = fp(async (f) => {
  f.get<{
    Querystring: Static<typeof QuerystringSchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/public/validateToken",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      const { token } = req.query;

      const cached = await f.redis.get(token);

      if (cached) {
        await f.redis.expire(token, authConfig.tokenTimeoutSeconds);
        return await rep.status(200).send({ identityId: cached });
      } else {
        if (!cached) {
          await f.redis.set(token, "", "EX", authConfig.tokenTimeoutSeconds);
        } else {
          await f.redis.expire(token, authConfig.tokenTimeoutSeconds);
        }
        return await rep.code(400).send({ code: ErrorCode.INVALID_TOKEN });
      }
    },
  );
});
