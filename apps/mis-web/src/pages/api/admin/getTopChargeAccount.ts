import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { Money } from "src/models/UserSchemaModel";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetTopChargeAccountResponse = Type.Object({
  results: Type.Array(Type.Object({
    accountName: Type.String(),
    userName: Type.String(),
    chargedAmount: Money,
  })),
});

export type GetTopChargeAccountResponse = Static<typeof GetTopChargeAccountResponse>;


export const GetTopChargeAccountSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    startTime: Type.String({ format: "date-time" }),

    endTime: Type.String({ format: "date-time" }),

    // 不传默认为10
    topRank: Type.Optional(Type.Number()),

  }),

  responses: {
    200: GetTopChargeAccountResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetTopChargeAccountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime, topRank } = req.query;

    const client = getClient(ChargingServiceClient);

    const { results } = await asyncClientCall(client, "getTopChargeAccount", {
      startTime,
      endTime,
      topRank,
    });

    return {
      200: {
        results: results.map((x) => ensureNotUndefined(x, ["chargedAmount"])),
      },
    };
  });
