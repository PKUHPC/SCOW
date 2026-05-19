import { Type, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CompressFilesSchema = typeboxRouteSchema({
  method: "PATCH",

  body: Type.Object({
    cluster: Type.String(),
    paths: Type.Array(Type.String()),
    archivePath: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    415: Type.Object({
      code: Type.Literal("COMPRESS_FAILED"),
      error: Type.String(),
    }),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
    429: Type.Object({ code: Type.Literal("NO_SPACE") }),
  },
});

const auth = authenticate(() => true);

export default route(CompressFilesSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, paths, archivePath } = req.body;

  const client = getClient(FileServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.compressFiles,
    operationTypePayload: {
      clusterId: "",
      paths,
      archivePath,
    },
  };

  return asyncUnaryCall(client, "compressFiles", {
    cluster,
    paths,
    archivePath,
    userId: info.identityId,
  }).then(
    async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.INTERNAL]: (e) => ({ 415: { code: "COMPRESS_FAILED" as const, error: e.details } }),
        [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
        [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
