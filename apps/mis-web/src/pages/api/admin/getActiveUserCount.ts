import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { StatisticServiceClient } from "@scow/protos/build/audit/statistic";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { DateSchema } from "src/models/date";
import { PlatformRole } from "src/models/User";
import { getAuditClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetActiveUserCountResponse = Type.Object({
  results: Type.Array(Type.Object({
    date: DateSchema,
    count: Type.Number(),
  })),
});

export type GetActiveUserCountResponse = Static<typeof GetActiveUserCountResponse>;


export const GetActiveUserCountSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    startTime: Type.String({ format: "date-time" }),

    endTime: Type.String({ format: "date-time" }),

    timeZone: Type.String(),

  }),

  responses: {
    200: GetActiveUserCountResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetActiveUserCountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime, timeZone } = req.query;

    const client = getAuditClient?.(StatisticServiceClient);

    if (client) {
      const { results } = await asyncClientCall(client, "getActiveUserCount", {
        startTime,
        endTime,
        timeZone,
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
    }
    return {
      200: {
        results: [],
      },
    };
  });
