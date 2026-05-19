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

export const SyncBlockStatusSchema = typeboxRouteSchema({
  method: "PUT",

  responses: {
    200: Type.Object({
      blockedFailedAccounts: Type.Array(Type.String()),
      blockedFailedUserAccounts: Type.Array(
        Type.Object({
          accountName: Type.String(),
          userId: Type.String(),
        }),
      ),
      unblockedFailedAccounts: Type.Array(Type.String()),
    }),
    409: Type.Null(),
  },
});
const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(SyncBlockStatusSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const client = getClient(AdminServiceClient);

  return await asyncClientCall(client, "syncBlockStatus", {})
    .then((x) => ({ 200: x }))
    .catch(
      handlegRPCError({
        [status.ALREADY_EXISTS]: () => ({ 409: null }),
      }),
    );
});
