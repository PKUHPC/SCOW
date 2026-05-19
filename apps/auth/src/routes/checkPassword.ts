import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";

const QuerystringSchema = Type.Object({
  identityId: Type.String(),
  password: Type.String(),
});

const ResponsesSchema = Type.Object({
  200: Type.Object({
    success: Type.Boolean({ description: "验证结果，ID和密码是否匹配" }),
  }),
  404: Type.Null({ description: "用户ID不存在" }),
  501: Type.Null({ description: "此功能在当前服务器配置下不可用" }),
});

export const checkPasswordRoute = fp(async (f) => {
  f.get<{
    Querystring: Static<typeof QuerystringSchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/checkPassword",
    {
      schema: {
        querystring: QuerystringSchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.checkPassword) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId, password } = req.query;

      const result = await f.auth.checkPassword(identityId, password, req);

      if (result === "Match") {
        return { success: true };
      } else if (result === "NotMatch") {
        return { success: false };
      } else if (result === "NotFound") {
        await rep.status(404).send({ code: "USER_NOT_FOUND" });
        return;
      }
      throw new Error("Unexpected result from checkPassword");
    },
  );
});
