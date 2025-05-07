import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { StatisticServiceClient } from "@scow/protos/build/audit/statistic";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getAuditClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetMisUsageCountResponse = Type.Object({
  results: Type.Array(Type.Object({
    operationType: Type.String(),
    count: Type.Number(),
  })),
});

export type GetMisUsageCountResponse = Static<typeof GetMisUsageCountResponse>;


export const GetMisUsageCountSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    startTime: Type.String({ format: "date-time" }),

    endTime: Type.String({ format: "date-time" }),

  }),

  responses: {
    200: GetMisUsageCountResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetMisUsageCountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime } = req.query;

    const client = getAuditClient?.(StatisticServiceClient);

    if (client) {
      const { results } = await asyncClientCall(client, "getMisUsageCount", {
        startTime,
        endTime,
      });
      return {
        200: {
          results,
        },
      };
    }
    return {
      200: {
        results: [],
      },
    };
  });
