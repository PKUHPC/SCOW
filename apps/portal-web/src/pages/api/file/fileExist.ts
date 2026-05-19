import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const FileExistSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
  }),

  responses: {
    200: Type.Object({ result: Type.Boolean() }),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
  },
});

const auth = authenticate(() => true);

export default route(FileExistSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { cluster, path } = req.query;

  const client = getClient(FileServiceClient);

  return asyncUnaryCall(client, "exists", {
    userId: info.identityId,
    cluster,
    path,
  }).then(
    (results) => ({ 200: { result: results.exists } }),
    handlegRPCError({
      [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
    }),
  );
});
