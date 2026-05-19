import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CancelJobSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    cluster: Type.String(),
    jobId: Type.Number(),
  }),

  responses: {
    204: Type.Null(),
    404: Type.Object({ code: Type.Literal("JOB_NOT_FOUND") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(CancelJobSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, jobId } = req.query;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.endJob,
    operationTypePayload: { jobId, clusterId: cluster },
  };

  return asyncUnaryCall(client, "cancelJob", {
    jobId,
    userId: info.identityId,
    cluster,
  }).then(
    async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.NOT_FOUND]: () => ({ 404: { code: "JOB_NOT_FOUND" } }) as const,
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
    ),
  );
});
