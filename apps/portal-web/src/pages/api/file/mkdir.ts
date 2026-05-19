import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const MkdirSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    409: Type.Object({ code: Type.Literal("ALREADY_EXISTS") }),
    429: Type.Object({ code: Type.Literal("NO_SPACE") }),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
  },
});

const auth = authenticate(() => true);

export default route(MkdirSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, path } = req.body;

  const client = getClient(FileServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createDirectory,
    operationTypePayload: {
      clusterId: "",
      path,
    },
  };

  return asyncUnaryCall(client, "makeDirectory", {
    cluster,
    path,
    userId: info.identityId,
  }).then(
    async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
        [status.ALREADY_EXISTS]: () => ({ 409: { code: "ALREADY_EXISTS" as const } }),
        [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
