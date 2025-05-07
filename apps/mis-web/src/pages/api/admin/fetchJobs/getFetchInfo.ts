import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use GetFetchInfoResponse from protos
export const GetFetchInfoResponse = Type.Object({
  fetchStarted: Type.Boolean(),
  schedule: Type.String(),
  lastFetchTime: Type.Optional(Type.String()),
});

export type GetFetchInfoResponse = Static<typeof GetFetchInfoResponse>;

export const GetFetchJobInfoSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: GetFetchInfoResponse,
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetFetchJobInfoSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(AdminServiceClient);

    const reply = await asyncClientCall(client, "getFetchInfo", {});

    return { 200: reply };

  });
