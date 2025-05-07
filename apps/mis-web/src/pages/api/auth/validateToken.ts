import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { Type } from "@sinclair/typebox";
import { validateToken } from "src/auth/token";
import { UserInfoSchema } from "src/models/User";
import { route } from "src/utils/route";

export const ValidateTokenSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({ token: Type.String() }),

  responses: {
    200: UserInfoSchema,
    403: Type.Null(),
  },

});

export default route(ValidateTokenSchema, async (req) => {

  const { token } = req.query;

  const info = await validateToken(token);

  if (!info) { return { 403: null }; }

  return { 200: info };

});


