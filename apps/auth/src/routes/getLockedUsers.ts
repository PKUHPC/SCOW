import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";

const QuerystringSchema = Type.Object({
  identityId: Type.Optional(Type.String()),
});

const ResponsesSchema = Type.Object({
  200: Type.Object({ user: Type.Array(Type.Object({
    identityId: Type.String(),
    name: Type.Optional(Type.String()),
    mail: Type.Optional(Type.String()),
    pwdAccountLockedTime: Type.Optional(Type.String()),
  })) }),
  501: Type.Null({ description: "此功能在当前服务器配置下不可用" }),
});

/**
 * 查询登录被锁定用户信息
 */
export const getLockedUsersRoute = fp(async (f) => {
  f.get<{
    Querystring: Static<typeof QuerystringSchema>
    Responses: Static<typeof ResponsesSchema>,
  }>(
    "/lockUser/getLockedUsers",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.getLockedUsers) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId } = req.query;
      const result = await f.auth.getLockedUsers(identityId, req);
      if (result) {
        return rep.code(200).send({ user: result });
      } else {
        return await rep.code(501).send(null);
      }
    },
  );
});
