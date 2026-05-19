import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Static, Type } from "@sinclair/typebox";
import { validateToken } from "src/auth/token";
import { route } from "src/utils/route";

export const UserInfo = Type.Object({
  identityId: Type.String(),
  name: Type.Optional(Type.String()),
});

export type UserInfo = Static<typeof UserInfo>;

export const ValidateTokenSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({ token: Type.String() }),

  responses: {
    200: UserInfo,
    403: Type.Null(),
  },
});

export default route(ValidateTokenSchema, async (req) => {
  const { token } = req.query;

  const info = await validateToken(token);

  if (!info) {
    return { 403: null };
  }

  return { 200: info };
});
