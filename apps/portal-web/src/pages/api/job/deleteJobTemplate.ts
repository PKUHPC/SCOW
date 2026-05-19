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

export const DeleteJobTemplateSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    cluster: Type.String(),
    templateId: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    404: Type.Object({ code: Type.Literal("TEMPLATE_NOT_FOUND") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(DeleteJobTemplateSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, templateId } = req.query;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.deleteJobTemplate,
    operationTypePayload: {
      jobTemplateId: templateId,
      clusterId: cluster,
    },
  };

  return asyncUnaryCall(client, "deleteJobTemplate", {
    templateId,
    userId: info.identityId,
    cluster,
  }).then(
    async () => {
      await callLog({ ...logInfo }, OperationResult.SUCCESS);
      return { 204: null };
    },
    handlegRPCError(
      {
        [status.NOT_FOUND]: () => ({ 404: { code: "TEMPLATE_NOT_FOUND" } }) as const,
      },
      async () => await callLog({ ...logInfo }, OperationResult.FAIL),
    ),
  );
});
