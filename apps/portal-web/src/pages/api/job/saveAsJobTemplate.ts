import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { JobTemplateServiceClient } from "@scow/protos/build/server/job_template";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getMisClient } from "src/utils/misClient";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SaveAsJobTemplateInfo = Type.Object({
  cluster: Type.String(),
  templateName: Type.String(),
  account: Type.String(),
  partition: Type.String(),
  qos: Type.String(),
  nodeCount: Type.Number(),
  coreCount: Type.Number(),
  gpuCount: Type.Number(),
  memoryMb: Type.Optional(Type.Number()),
  maxTime: Type.Number(),
  maxTimeUnit: Type.Optional(Type.Number()),
  command: Type.Optional(Type.String()),
});

export type SaveAsJobTemplateInfo = Static<typeof SaveAsJobTemplateInfo>;

export const SaveAsJobTemplateSchema = typeboxRouteSchema({
  method: "POST",

  body: SaveAsJobTemplateInfo,

  responses: {
    200: Type.Object({ id: Type.Number() }),
    409: Type.Object({ code: Type.Literal("ALREADY_EXISTS") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(SaveAsJobTemplateSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const {
    cluster,
    templateName,
    account,
    partition,
    qos,
    nodeCount,
    coreCount,
    gpuCount,
    memoryMb,
    maxTime,
    maxTimeUnit,
    command,
  } = req.body;

  const client = getMisClient(JobTemplateServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.addJobTemplate,
    operationTypePayload: {
      jobTemplateId: templateName,
      clusterId: cluster,
    },
  };

  return asyncUnaryCall(client, "saveJobTemplate", {
    userId: info.identityId,
    cluster,
    templateName,
    account,
    partition,
    qos,
    nodeCount,
    coreCount,
    gpuCount,
    maxTime: maxTime,
    maxTimeUnit: maxTimeUnit ?? 0,
    memoryMb,
    command,
  }).then(
    async (reply) => {
      await callLog({ ...logInfo }, OperationResult.SUCCESS);
      return { 200: { id: reply.id } };
    },
    handlegRPCError(
      {
        [status.ALREADY_EXISTS]: () => ({ 409: { code: "ALREADY_EXISTS" as const } }),
      },
      async () => await callLog({ ...logInfo }, OperationResult.FAIL),
    ),
  );
});
