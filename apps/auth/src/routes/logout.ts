import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
const QuerystringSchema = Type.Object({
  token: Type.String(),
});

const ResponsesSchema = Type.Object({
  204: Type.Null(),
});

/**
 * 无效化一个token
 */
export const logoutRoute = fp(async (f) => {
  f.delete<{
    Querystring: Static<typeof QuerystringSchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/token",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      const { token } = req.query;

      await f.redis.del(token);

      return rep.code(204).send(null);
    },
  );
});
