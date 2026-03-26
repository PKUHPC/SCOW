import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { JobServiceClient, TimeUnit } from "@scow/protos/build/portal/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SaveAsJobTemplateInfo = Type.Object({
  cluster: Type.String(),
  jobName: Type.String(),
  account: Type.String(),
  partition: Type.String(),
  qos: Type.String(),
  nodeCount: Type.Number(),
  coreCount: Type.Number(),
  gpuCount: Type.Optional(Type.Number()),
  memoryMb: Type.String(),
  command: Type.String(),
  maxTime: Type.Number(), // 最长运行时间
  maxTimeUnit: Type.Enum(TimeUnit), // 最长运行时间单位，默认为MINUTES
});

export type SaveAsJobTemplateInfo = Static<typeof SaveAsJobTemplateInfo>;

export const SaveAsJobTemplateSchema = typeboxRouteSchema({
  method: "POST",

  body: SaveAsJobTemplateInfo,

  responses: {
    204: Type.Null(),
    404: Type.Object({ code: Type.Literal("UNIMPLEMENTED"), message: Type.String() }),
    429: Type.Object({ code: Type.Literal("NO_SPACE") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(SaveAsJobTemplateSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, jobName, account, partition, qos, nodeCount, coreCount, gpuCount, memoryMb,
    command, maxTime, maxTimeUnit } = req.body;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.addJobTemplate,
    operationTypePayload:{
      jobTemplateId: jobName,
      clusterId: cluster,
    },
  };

  return asyncUnaryCall(client, "saveAsJobTemplate", {
    userId: info.identityId,
    cluster,
    jobName,
    account,
    partition,
    qos,
    nodeCount,
    coreCount,
    gpuCount,
    memoryMb,
    command,
    maxTime,
    maxTimeUnit: maxTimeUnit ?? TimeUnit.MINUTES,
  }).then(async () => {
    await callLog({ ...logInfo }, OperationResult.SUCCESS);
    return { 204: null };
  }, handlegRPCError({
    [status.UNIMPLEMENTED]: (err) => ({ 404: { code: "UNIMPLEMENTED", message: err.details } } as const),
    [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
  },
  async () => await callLog({ ...logInfo }, OperationResult.FAIL),
  ));
});
