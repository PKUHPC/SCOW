import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { ModifyForcedResult } from "src/auth/AuthProvider";

const BodySchema = Type.Object({
  identityId: Type.String(),
  forceFlag: Type.Boolean(),
});

const ResponsesSchema = Type.Object({
  204: Type.Null({ description: "修改完成" }),
  404: Type.Null({ description: "用户未找到" }),
  501: Type.Null({ description: "不支持修改pwdReset属性" }),
});

const codes: Record<ModifyForcedResult, number> = {
  NotFound: 404,
  OK: 204,
};

/**
 * 修改强制修改密码属性pwdReset
 */
export const updatePasswordFlagRoute = fp(async (f) => {
  f.patch<{
    Body: Static<typeof BodySchema>
    Responses: Static<typeof ResponsesSchema>,
  }>(
    "/updatePasswordResetFlag",
    {
      schema: {
        body: BodySchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {

      if (!f.auth.updatePasswordResetFlag) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId, forceFlag } = req.body;

      const result = await f.auth.updatePasswordResetFlag(identityId, forceFlag, req);

      await rep.code(codes[result]).send(null);
    },
  );
});
