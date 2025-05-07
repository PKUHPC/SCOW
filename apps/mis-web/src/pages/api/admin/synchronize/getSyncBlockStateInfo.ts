import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use GetSyncBlockStatusInfoResponse from protos
export const GetSyncBlockStatusInfoResponse = Type.Object({
  syncStarted: Type.Boolean(),
  schedule: Type.String(),
  lastSyncTime: Type.Optional(Type.String()),
});

export type GetSyncBlockStatusInfoResponse = Static<typeof GetSyncBlockStatusInfoResponse>;

export const GetSyncBlockStatusJobInfoSchema = typeboxRouteSchema({
  method: "GET",

  responses: {
    200: GetSyncBlockStatusInfoResponse,
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetSyncBlockStatusJobInfoSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(AdminServiceClient);

    const reply = await asyncClientCall(client, "getSyncBlockStatusInfo", {});

    return { 200: reply };

  });
