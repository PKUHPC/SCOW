import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { DateSchema } from "src/models/date";
import { PlatformRole } from "src/models/User";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetNewJobCountResponse = Type.Object({
  results: Type.Array(Type.Object({
    date: DateSchema,
    count: Type.Number(),
  })),
});

export type GetNewJobCountResponse = Static<typeof GetNewJobCountResponse>;


export const GetNewJobCountSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    startTime: Type.String({ format: "date-time" }),

    endTime: Type.String({ format: "date-time" }),

    timeZone: Type.String(),

  }),

  responses: {
    200: GetNewJobCountResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetNewJobCountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime, timeZone } = req.query;

    const client = getClient(JobServiceClient);

    const { results } = await asyncClientCall(client, "getNewJobCount", {
      startTime,
      endTime,
      timeZone,
    });

    return {
      200: {
        results: results.filter((x) => x.date !== undefined)
          .map((x) => ensureNotUndefined(x, ["date"])),
      },
    };
  });
