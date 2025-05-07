import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetStatisticInfoResponse = Type.Object({
  totalUser: Type.Number(),
  totalAccount: Type.Number(),
  totalTenant: Type.Number(),
  newUser: Type.Number(),
  newAccount: Type.Number(),
  newTenant: Type.Number(),
  refreshTime: Type.String({ format: "date-time" }),
});

export type GetStatisticInfoResponse = Static<typeof GetStatisticInfoResponse>;


export const GetStatisticInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({

    /**
     * @format date-time
     */
    startTime: Type.String({ format: "date-time" }),

    /**
     * @format date-time
     */
    endTime: Type.String({ format: "date-time" }),

  }),

  responses: {
    200: GetStatisticInfoResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetStatisticInfoSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { startTime, endTime } = req.query;

    const client = getClient(AdminServiceClient);

    const results = await asyncClientCall(client, "getStatisticInfo", {
      startTime,
      endTime,
    });

    return {
      200: {
        ...results,
        refreshTime: results.refreshTime!,
      },
    };
  });
