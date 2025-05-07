import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetTopSubmitJobUserResponse = Type.Object({
  results: Type.Array(Type.Object({
    userId: Type.String(),
    count: Type.Number(),
  })),
});

export type GetTopSubmitJobUserResponse = Static<typeof GetTopSubmitJobUserResponse>;


export const GetTopSubmitJobUserSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    startTime: Type.String({ format: "date-time" }),

    endTime: Type.String({ format: "date-time" }),

    // 不传默认为10
    topRank: Type.Optional(Type.Number()),

  }),

  responses: {
    200: GetTopSubmitJobUserResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetTopSubmitJobUserSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime, topRank } = req.query;

    const client = getClient(JobServiceClient);

    const { results } = await asyncClientCall(client, "getTopSubmitJobUsers", {
      startTime,
      endTime,
      topRank,
    });

    return {
      200: {
        results,
      },
    };
  });
