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

export const DeleteFileSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    cluster: Type.String(),
    path: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    400: Type.Object({ code: Type.Literal("INVALID_CLUSTER") }),
  },
});

const auth = authenticate(() => true);

export default route(DeleteFileSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, path } = req.query;

  const client = getClient(FileServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deleteFile,
    operationTypePayload: {
      clusterId: "",
      path,
    },
  };

  return asyncUnaryCall(client, "deleteFile", {
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
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
