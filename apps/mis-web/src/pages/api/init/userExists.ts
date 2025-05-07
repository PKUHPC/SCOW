import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { InitServiceClient } from "@scow/protos/build/server/init";
import { Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const UserExistsSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    identityId: Type.String(),
  }),

  responses: {
    200: Type.Object({
      existsInScow: Type.Boolean(),
      existsInAuth: Type.Optional(Type.Boolean()),
    }),

    // 204: null;
  },
});

export default route(UserExistsSchema, async (req) => {

  const { identityId } = req.body;

  const client = getClient(InitServiceClient);
  const result = await asyncClientCall(client, "userExists", {
    userId: identityId,
  });

  return {
    200:
    {
      existsInScow: result.existsInScow,
      existsInAuth: result.existsInAuth,
    },
  };
});
