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

export const RenameJobTemplateSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    templateId: Type.String(),
    jobName: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    404: Type.Object({ code: Type.Literal("TEMPLATE_NOT_FOUND") }),
    429: Type.Object({ code: Type.Literal("NO_SPACE") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(RenameJobTemplateSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, templateId, jobName } = req.body;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.updateJobTemplate,
    operationTypePayload:{
      jobTemplateId: templateId,
      newJobTemplateId: jobName,
      clusterId: cluster,
    },
  };

  return asyncUnaryCall(client, "renameJobTemplate", {
    templateId, userId: info.identityId, cluster, jobName,
  }).then(async () => {
    await callLog({ ...logInfo }, OperationResult.SUCCESS);
    return { 204: null };
  }, handlegRPCError({
    [status.NOT_FOUND]: () => ({ 404: { code: "TEMPLATE_NOT_FOUND" } } as const),
    [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
  },
  async () => await callLog({ ...logInfo }, OperationResult.FAIL),
  ));
});
