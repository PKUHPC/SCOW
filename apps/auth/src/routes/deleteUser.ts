import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { DeleteUserResult } from "src/auth/AuthProvider";
import { deleteUserTokens } from "src/utils/deleteUserTokens";

const QuerystringSchema = Type.Object({
  identityId: Type.String({ description: "用户ID" }),
});

const ResponsesSchema = Type.Object({
  204: Type.Null({ description: "删除成功" }),
  404: Type.Null({ description: "未找到该用户" }),
  501: Type.Null({ description: "不支持ldap禁止用户登录" }),
  500: Type.Null({ description: "删除失败" }),
});

const codes: Record<DeleteUserResult, number> = {
  NotFound: 404,
  OK: 204,
  Failed: 501,
};

/**
 * 删除用户，其实是改变用户状态
 */
export const deleteUserRoute = fp(async (f) => {
  f.delete<{
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
      if (!f.auth.deleteUser) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId } = req.query;

      const result = await f.auth.deleteUser(identityId, req);

      // 如果用户删除成功，删除 Redis 中的 token
      if (result === "OK") {
        try {
          await deleteUserTokens(identityId, req);
        } catch (err) {
          req.log.error(`Failed to delete tokens for user ${identityId}:`, err);
          return await rep.code(500).send({ code: "DELETE_FAILED" });
        }
      }

      return await rep.status(codes[result]).send(null);
    },
  );
});
