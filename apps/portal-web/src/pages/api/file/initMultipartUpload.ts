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

import { FileInfo, mapType } from "./list";

export const InitMultipartUploadSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    name: Type.String(),
  }),

  responses: {
    200: Type.Object({
      tempFileDir: Type.String(),
      chunkSizeByte: Type.Number(),
      filesInfo: Type.Array(FileInfo),
    }),
    403: Type.Object({ code: Type.Literal("PERMISSION_DENIED") }),
    500: Type.Object({ code: Type.Literal("INITIAL_UPLOAD_FAILED") }),
    501: Type.Object({ code: Type.Literal("UNIMPLEMENTED") }),
    520: Type.Object({ code: Type.Literal("UNKNOWN_ERROR") }),
  },
});

const auth = authenticate(() => true);

export default route(InitMultipartUploadSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, path, name } = req.body;

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.uploadFile,
    operationTypePayload:{
      clusterId: cluster, path: join(path, name),
    },
  };

  const client = getClient(FileServiceClient);

  return asyncUnaryCall(client, "initMultipartUpload", {
    cluster, path, userId: info.identityId, name,
  }).then(async (res) => {
    return { 200: {
      ...res,
      filesInfo: res.filesInfo.map(({ mode, mtime, name, size, type }) => ({
        mode, mtime, name, size, type: mapType[type],
      })),
    } };
  }, handlegRPCError({
    [status.INTERNAL]: () => ({ 500: { code: "INITIAL_UPLOAD_FAILED" as const } }),
    [status.PERMISSION_DENIED]: () => ({ 403: { code: "PERMISSION_DENIED" as const } }),
    [status.UNKNOWN]: () => ({ 520: { code: "UNKNOWN_ERROR" as const } }),
    [status.UNIMPLEMENTED]: () => ({ 501: { code: "UNIMPLEMENTED" as const } }),
  }, async () => await callLog(logInfo, OperationResult.FAIL)));

});
