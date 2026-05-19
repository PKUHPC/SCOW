import { Static, Type } from "@sinclair/typebox";
import fp from "fastify-plugin";
import { CreateUserResult } from "src/auth/AuthProvider";

const BodySchema = Type.Object({
  mail: Type.String(),
  id: Type.Integer(),
  identityId: Type.String(),
  name: Type.String(),
  password: Type.String(),
});

const ResponsesSchema = Type.Object({
  // 不能用Any或者Unknown
  // 因为生成的json schema为{ description: "" }
  // fastify将会把这种格式认为是一个只包含有description key的object
  // https://www.fastify.io/docs/latest/Reference/Validation-and-Serialization/#serialization

  204: Type.Null({ description: "创建成功" }),
  409: Type.Null({ description: "用户ID已经存在" }),
  501: Type.Null({ description: "此功能在当前服务器配置下不可用" }),
});

const codes: Record<CreateUserResult, number> = {
  AlreadyExists: 409,
  OK: 204,
};

/**
 * 创建用户
 */
export const createUserRoute = fp(async (f) => {
  f.post<{
    Body: Static<typeof BodySchema>;
    Responses: Static<typeof ResponsesSchema>;
  }>(
    "/user",
    {
      schema: {
        body: BodySchema,
        response: ResponsesSchema.properties,
      },
    },
    async (req, rep) => {
      if (!f.auth.createUser) {
        return await rep.code(501).send({ code: "NOT_SUPPORTED" });
      }

      const { ...rest } = req.body;

      const result = await f.auth.createUser(rest, req);

      return await rep.status(codes[result]).send();
    },
  );
});
