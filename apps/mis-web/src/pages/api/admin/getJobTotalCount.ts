import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const GetJobTotalCountResponse = Type.Object({
  count: Type.Number(),
  refreshTime: Type.String({ format: "date-time" }),
});

export type GetJobTotalCountResponse = Static<typeof GetJobTotalCountResponse>;


export const GetJobTotalCountSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: GetJobTotalCountResponse,
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetJobTotalCountSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }
    const client = getClient(JobServiceClient);

    const result = await asyncClientCall(client, "getJobTotalCount", {});

    return {
      200: {
        ...result,
        refreshTime: result.refreshTime!,
      },
    };
  });
