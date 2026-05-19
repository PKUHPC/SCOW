import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";

const QuerystringSchema = Type.Object({
  identityId: Type.String(),
});

const ResponsesSchema = Type.Object({
  200: Type.Object({
    user: Type.Object({
      identityId: Type.String(),
      name: Type.Optional(Type.String()),
      mail: Type.Optional(Type.String()),
    }),
  }),
  404: Type.Object({ code: Type.Literal("USER_NOT_FOUND") }),
  501: Type.Null({ description: "此功能在当前服务器配置下不可用" }),
});

/**
 * 查询用户信息
 */
export const getUserRoute = fp(async (f) => {
  f.get<{
    Querystring: Static<typeof QuerystringSchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/user",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.getUser) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId } = req.query;

      const result = await f.auth.getUser(identityId, req);

      if (result) {
        return rep.code(200).send({ user: result });
      } else {
        return rep.code(404).send({ code: "USER_NOT_FOUND" });
      }
    },
  );
});
