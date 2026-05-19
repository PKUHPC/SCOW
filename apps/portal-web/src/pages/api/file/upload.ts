import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncRequestStreamCall } from "@ddadaal/tsgrpc-client";
import { OperationType } from "@scow/lib-operation-log";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import busboy, { BusboyEvents } from "busboy";
import { once } from "events";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { pipeline } from "src/utils/pipeline";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";
import { pipeline as pipelineStream } from "stream/promises";

export const UploadFileSchema = typeboxRouteSchema({
  method: "POST",

  query: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
    chunkIdx: Type.Optional(Type.Number()),
    chunk: Type.Optional(Type.Boolean()), // Added to control logging for chunked uploads
    originPath: Type.Optional(Type.String()),
  }),

  responses: {
    204: Type.Null(),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
  },
});

const auth = authenticate(() => true);

export default route(UploadFileSchema, async (req, res) => {
  const { cluster, path, chunkIdx, chunk, originPath } = req.query;

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const bb = busboy({ headers: req.headers });

  const client = getClient(FileServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.uploadFile,
    operationTypePayload: {
      clusterId: cluster,
      path: originPath ? originPath : path,
    },
  };

  pipelineStream(req, bb);

  const [_name, file] = (await once(bb, "file").catch(async (e) => {
    await callLog(logInfo, OperationResult.FAIL);
    throw new Error("Error when waiting for file upload", { cause: e });
  })) as Parameters<BusboyEvents["file"]>;

  return await asyncRequestStreamCall(client, "upload", async ({ writeAsync }, stream) => {
    await writeAsync({
      message: {
        $case: "info",
        info: { cluster, path, userId: info.identityId, chunkIdx },
      },
    });

    await pipeline(file, (chunk) => ({ message: { $case: "chunk" as const, chunk } }), stream).catch(async (e) => {
      await callLog(logInfo, OperationResult.FAIL);
      throw new Error("Error when writing stream", { cause: e });
    });
  })
    .then(async () => {
      if (!chunk) {
        await callLog(logInfo, OperationResult.SUCCESS);
      }
      return { 204: null };
    })
    .finally(() => {
      bb.end();
    });
});

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};
