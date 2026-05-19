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

export const CopyFileItemSchema = typeboxRouteSchema({
  method: "PATCH",

  body: Type.Object({
    cluster: Type.String(),
    fromPath: Type.String(),
    toPath: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    415: Type.Object({
      code: Type.Literal("CP_CMD_FAILED"),
      error: Type.String(),
    }),
    429: Type.Object({ code: Type.Literal("NO_SPACE") }),
    400: Type.Object({
      code: Type.Union([Type.Literal("INVALID_CLUSTER"), Type.Literal("INVALID_ARGUMENT")]),
      error: Type.Optional(Type.String()),
    }),
  },
});

const auth = authenticate(() => true);

export default route(CopyFileItemSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, fromPath, toPath } = req.body;

  const client = getClient(FileServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.copyFileItem,
    operationTypePayload: {
      clusterId: "",
      fromPath,
      toPath,
    },
  };

  return asyncUnaryCall(client, "copy", {
    cluster,
    fromPath,
    toPath,
    userId: info.identityId,
  }).then(
    async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.INTERNAL]: (e) => ({ 415: { code: "CP_CMD_FAILED" as const, error: e.details } }),
        [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
        [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
        [status.INVALID_ARGUMENT]: (e) => ({ 400: { code: "INVALID_ARGUMENT" as const, error: e.details } }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
