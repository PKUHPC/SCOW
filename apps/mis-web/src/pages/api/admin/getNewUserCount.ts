import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { DateSchema } from "src/models/date";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetNewUserCountResponse = Type.Object({
  results: Type.Array(Type.Object({
    date: DateSchema,
    count: Type.Number(),
  })),
});

export type GetNewUserCountResponse = Static<typeof GetNewUserCountResponse>;


export const GetNewUserCountSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    startTime: Type.String({ format: "date-time" }),

    endTime: Type.String({ format: "date-time" }),

    timeZone: Type.String(),

  }),

  responses: {
    200: GetNewUserCountResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetNewUserCountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime, timeZone } = req.query;

    const client = getClient(UserServiceClient);

    const { results } = await asyncClientCall(client, "getNewUserCount", {
      startTime,
      endTime,
      timeZone: timeZone,
    });

    return {
      200: {
        results: results
          .filter((x) => x.date !== undefined)
          .map((x) => ({
            date: x.date!,
            count: x.count,
          })),
      },
    };
  });
