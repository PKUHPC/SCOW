import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import { join } from "path";
import { authenticate } from "src/auth/server";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const InitMultipartUploadSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    name: Type.String(),
    fileSizeByte: Type.Number(),
    modificationTime: Type.Number(),
  }),

  responses: {
    200: Type.Object({
      chunkSizeByte: Type.Number(),
      fileSizeByte: Type.Number(),
      modificationTime: Type.Number(),
      uploadedIndices: Type.Array(Type.Number()), // 已上传文件块索引
    }),
    403: Type.Object({ code: Type.Literal("PERMISSION_DENIED") }),
    429: Type.Object({ code: Type.Literal("NO_SPACE") }),
    500: Type.Object({ code: Type.Literal("INITIAL_UPLOAD_FAILED") }),
    501: Type.Object({ code: Type.Literal("UNIMPLEMENTED") }),
    520: Type.Object({ code: Type.Literal("UNKNOWN_ERROR") }),
  },
});

const auth = authenticate(() => true);

export default route(InitMultipartUploadSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, path, name, fileSizeByte, modificationTime } = req.body;

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.uploadFile,
    operationTypePayload: {
      clusterId: cluster,
      path: join(path, name),
    },
  };

  const client = getClient(FileServiceClient);

  return asyncUnaryCall(client, "initMultipartUpload", {
    cluster,
    path,
    userId: info.identityId,
    name,
    fileSizeByte,
    modificationTime,
  }).then(
    async (res) => {
      return { 200: { ...res } };
    },
    handlegRPCError(
      {
        [status.INTERNAL]: () => ({ 500: { code: "INITIAL_UPLOAD_FAILED" as const } }),
        [status.PERMISSION_DENIED]: () => ({ 403: { code: "PERMISSION_DENIED" as const } }),
        [status.UNKNOWN]: () => ({ 520: { code: "UNKNOWN_ERROR" as const } }),
        [status.UNIMPLEMENTED]: () => ({ 501: { code: "UNIMPLEMENTED" as const } }),
        [status.RESOURCE_EXHAUSTED]: (e) => ({ 429: { code: "NO_SPACE" as const, error: e.details } }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
