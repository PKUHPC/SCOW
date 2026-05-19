import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const CheckTransferKeySchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    fromCluster: Type.String(),
    toCluster: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    415: Type.Object({
      code: Type.Literal("CHECK_KEY_OF_TRANSFERRING_CROSS_CLUSTER_FAILED"),
      error: Type.String(),
    }),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
  },
});

const auth = authenticate(() => true);

export default route(CheckTransferKeySchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { fromCluster, toCluster } = req.body;

  const client = getClient(FileServiceClient);

  return asyncUnaryCall(client, "checkTransferKey", {
    userId: info.identityId,
    fromCluster: fromCluster,
    toCluster: toCluster,
  }).then(
    () => ({ 204: null }),
    handlegRPCError({
      [status.INTERNAL]: (e) => ({
        415: {
          code: "CHECK_KEY_OF_TRANSFERRING_CROSS_CLUSTER_FAILED" as const,
          error: e.details,
        },
      }),
      [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
    }),
  );
});
