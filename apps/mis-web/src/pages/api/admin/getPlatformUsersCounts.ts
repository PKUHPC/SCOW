import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetPlatformUsersCountsResponse = Type.Object({
  totalCount: Type.Number(),
  totalAdminCount: Type.Number(),
  totalFinanceCount: Type.Number(),
});
export type GetPlatformUsersCountsResponse = Static<typeof GetPlatformUsersCountsResponse>;

export const GetPlatformUsersCountsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    idOrName: Type.Optional(Type.String()),
  }),

  responses: {
    200: GetPlatformUsersCountsResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetPlatformUsersCountsSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }
    const { idOrName } = req.query;
    const client = getClient(UserServiceClient);

    const result = await asyncClientCall(client, "getPlatformUsersCounts", {
      idOrName,
    });

    return {
      200: result,
    };
  });
