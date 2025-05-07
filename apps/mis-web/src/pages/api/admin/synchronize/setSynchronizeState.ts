import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const SetSyncBlockStatusStateSchema = typeboxRouteSchema({
  method: "POST",

  query: Type.Object({
    started: Type.Boolean(),
  }),

  responses: {
    204: Type.Null(),
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(SetSyncBlockStatusStateSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const client = getClient(AdminServiceClient);

    await asyncClientCall(client, "setSyncBlockStatusState", { started: req.query.started });

    return { 204: null };

  });
