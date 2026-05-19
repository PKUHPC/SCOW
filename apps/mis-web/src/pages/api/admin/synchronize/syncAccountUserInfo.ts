import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const SyncAccountUserInfoSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    maxSyncDurationMinutes: Type.Number(),
  }),
  responses: {
    200: Type.Object({
      sessionId: Type.String(),
    }),
    409: Type.Null(),
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(SyncAccountUserInfoSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { maxSyncDurationMinutes } = req.body;

  const client = getClient(AdminServiceClient);

  return await asyncClientCall(client, "startAccountUserSynchronization", {
    operatorId: info.identityId,
    maxSyncDurationMinutes,
  })
    .then((x) => ({ 200: x }))
    .catch(
      handlegRPCError({
        [status.ALREADY_EXISTS]: () => ({ 409: null }),
      }),
    );
});
