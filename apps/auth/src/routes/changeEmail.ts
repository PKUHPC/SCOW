import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { ChangeEmailResult } from "src/auth/AuthProvider";

const BodySchema = Type.Object({
  identityId: Type.String({ description: "用户ID" }),
  newEmail: Type.String({ description: "新邮箱" }),
});

const ResponsesSchema = Type.Object({
  204: Type.Null({ description: "修改完成" }),
  404: Type.Null({ description: "用户未找到" }),
  501: Type.Null({ description: "不支持修改邮箱功能" }),
});

const codes: Record<ChangeEmailResult, number> = {
  NotFound: 404,
  OK: 204,
};

/**
 * 修改邮箱
 */
export const changeEmailRoute = fp(async (f) => {
  f.patch<{
    Body: Static<typeof BodySchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/user/email",
    {
      schema: {
        body: BodySchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.changeEmail) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId, newEmail } = req.body;

      const result = await f.auth.changeEmail(identityId, newEmail, req);

      await rep.code(codes[result]).send(null);
    },
  );
});
