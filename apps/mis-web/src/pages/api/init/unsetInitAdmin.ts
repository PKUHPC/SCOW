import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { InitServiceClient } from "@scow/protos/build/server/init";
import { Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const UnsetInitAdminSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    userId: Type.String(),
  }),

  responses: {
    204: Type.Null(),

    409: Type.Object({ code: Type.Literal("ALREADY_INITIALIZED") }),

  },
});

export default route(UnsetInitAdminSchema, async (req) => {
  const result = await queryIfInitialized();

  if (result) { return { 409: { code: "ALREADY_INITIALIZED" as const } }; }

  const { userId } = req.query;

  const client = getClient(InitServiceClient);

  await asyncClientCall(client, "unsetInitAdmin", {
    userId,
  });

  return { 204: null };

});

