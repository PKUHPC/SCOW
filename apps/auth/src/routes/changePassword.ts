import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { ChangePasswordResult } from "src/auth/AuthProvider";

const BodySchema = Type.Object({
  identityId: Type.String({ description: "用户ID" }),
  newPassword: Type.String({ description: "新密码" }),
});

const SelfBodySchema = Type.Object({
  id: Type.String({ description: "用户ID" }),
  oldPassword: Type.String({ description: "旧密码" }),
  newPassword: Type.String({ description: "新密码" }),
});

const ResponsesSchema = Type.Object({
  204: Type.Null({ description: "修改完成" }),
  404: Type.Null({ description: "用户未找到" }),
  501: Type.Null({ description: "当前配置不支持修改密码" }),
});

const codes: Record<ChangePasswordResult, number> = {
  NotFound: 404,
  OK: 204,
};

/**
 * 管理员修改密码
 */
export const changePasswordRoute = fp(async (f) => {
  f.patch<{
    Body: Static<typeof BodySchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/password",
    {
      schema: {
        body: BodySchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.changePassword) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId, newPassword } = req.body;

      const result = await f.auth.changePassword(identityId, newPassword, req);

      await rep.code(codes[result]).send(null);
    },
  );
});

/**
 * 用户修改自己密码
 */
export const changePasswordUserSelfRoute = fp(async (f) => {
  f.patch<{
    Body: Static<typeof SelfBodySchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/public/passwordUserSelf",
    {
      schema: {
        body: SelfBodySchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.changePassword || !f.auth.checkPassword) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { id, oldPassword, newPassword } = req.body;

      const checkResult = await f.auth.checkPassword(id, oldPassword, req);
      if (checkResult === "Match") {
        const result = await f.auth.changePassword(id, newPassword, req);
        await f.auth?.updatePasswordResetFlag?.(id, false, req);
        return await rep.code(codes[result]).send(null);
      } else if (checkResult === "NotMatch") {
        return { success: false };
      } else if (checkResult === "NotFound") {
        return await rep.status(404).send({ code: "USER_NOT_FOUND" });
      }
    },
  );
});
