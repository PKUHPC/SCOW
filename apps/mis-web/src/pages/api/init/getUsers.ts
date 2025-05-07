import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { User } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const InitGetUsersSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: Type.Object({
      users: Type.Array(User),
    }),

    409: Type.Object({ code: Type.Literal("ALREADY_INITIALIZED") }),
  },
});

export default route(InitGetUsersSchema, async () => {

  const result = await queryIfInitialized();

  if (result) { return { 409: { code: "ALREADY_INITIALIZED" as const } }; }

  const client = getClient(UserServiceClient);

  const reply = await asyncClientCall(client, "getUsers", {
    tenantName: DEFAULT_TENANT_NAME,
  });

  return {
    200: {
      users: reply.users,
    },
  };

});
