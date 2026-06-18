import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { AppTemplateServiceClient } from "@scow/protos/build/server/app_template";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getMisClient } from "src/utils/misClient";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SaveAsAppTemplateInfo = Type.Object({
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
  appId: Type.String(),
  customAttributes: Type.Optional(Type.String()),
});

export type SaveAsAppTemplateInfo = Static<typeof SaveAsAppTemplateInfo>;

export const SaveAsAppTemplateSchema = typeboxRouteSchema({
  method: "POST",

  body: SaveAsAppTemplateInfo,

  responses: {
    200: Type.Object({ id: Type.Number() }),
    409: Type.Object({ code: Type.Literal("ALREADY_EXISTS") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(SaveAsAppTemplateSchema, async (req, res) => {
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
    appId,
    customAttributes,
  } = req.body;

  const client = getMisClient(AppTemplateServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.addJobTemplate,
    operationTypePayload: {
      jobTemplateId: templateName,
      clusterId: cluster,
    },
  };

  return asyncUnaryCall(client, "saveAppTemplate", {
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
    appId,
    customAttributes,
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
