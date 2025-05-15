import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { UnlockUserResult } from "src/auth/AuthProvider";

const BodySchema = Type.Object({
  identityId: Type.String({ description: "用户ID" }),
});

const ResponsesSchema = Type.Object({
  204: Type.Null({ description: "解封成功" }),
  404: Type.Null({ description: "未找到该用户" }),
  501: Type.Null({ description: "不支持LDAP用户解封" }),
  500: Type.Null({ description: "解封失败" }),
});

const codes: Record<UnlockUserResult, number> = {
  OK: 204,
  NotFound: 404,
  Failed: 500,
};

/**
 * 解锁用户
 */
export const unlockUserRoute = fp(async (f) => {
  f.patch<{
    Body: Static<typeof BodySchema>
    Responses: Static<typeof ResponsesSchema>,
  }>(
    "/lockUser/unlock",
    {
      schema: {
        body: BodySchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.unlockUser) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { identityId } = req.body;

      const result = await f.auth.unlockUser(identityId, req);

      await rep.code(codes[result]).send(null);
    },
  );
});
