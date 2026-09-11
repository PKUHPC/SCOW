import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const ConfirmAccountStorageQuotaSchema = typeboxRouteSchema({
  method: "POST",
  responses: {
    204: Type.Null(),
    409: Type.Object({
      code: Type.String(),
    }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(ConfirmAccountStorageQuotaSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "setConfirmedEnableAccountQuota", {})
    .then(() => ({ 204: null }))
    .catch(handlegRPCError({
      [Status.FAILED_PRECONDITION]: () => ({ 409: { code: "FAILED" } }),
    }));
});
