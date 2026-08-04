import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { JobServiceClient, TimeUnit } from "@scow/protos/build/portal/job";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SubmitJobInfo = Type.Object({
  cluster: Type.String(),
  partition: Type.String(),
  nodeCount: Type.Number(),
  coreCount: Type.Number(),
  gpuCount: Type.Optional(Type.Number()),
  command: Type.String(),
  jobName: Type.String(),
  qos: Type.Optional(Type.String()),
  maxTime: Type.Number(),
  account: Type.String(),
  workingDirectory: Type.String(),
  output: Type.String(),
  errorOutput: Type.String(),
  memory: Type.Optional(Type.String()),
  comment: Type.Optional(Type.String()),
  save: Type.Boolean(),
  scriptOutput: Type.Optional(Type.String()),
  maxTimeUnit: Type.Optional(Type.Enum(TimeUnit)),
});

export type SubmitJobInfo = Static<typeof SubmitJobInfo>;

export const SubmitJobSchema = typeboxRouteSchema({
  method: "POST",

  body: SubmitJobInfo,

  responses: {
    201: Type.Object({
      jobId: Type.Number(),
    }),

    400: Type.Object({
      code: Type.Literal("INVALID_ARGUMENT"),
      message: Type.String(),
    }),

    403: Type.Object({
      code: Type.Union([
        Type.Literal("USER_ACCOUNT_NOT_AVAILABLE"),
        Type.Literal("CLUSTER_PARTITION_NOT_AVAILABLE"),
        Type.Literal("PERMISSION_DENIED"),
      ]),
      message: Type.String(),
    }),

    404: Type.Object({
      code: Type.Literal("NOT_FOUND"),
      message: Type.String(),
    }),

    429: Type.Object({ code: Type.Literal("NO_SPACE") }),

    500: Type.Object({
      code: Type.Literal("SCHEDULER_FAILED"),
      message: Type.String(),
    }),
  },
});

const auth = authenticate(() => true);

export default route(SubmitJobSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const {
    cluster,
    command,
    jobName,
    coreCount,
    gpuCount,
    maxTime,
    maxTimeUnit,
    save,
    nodeCount,
    partition,
    qos,
    account,
    comment,
    workingDirectory,
    output,
    errorOutput,
    scriptOutput,
    memory,
  } = req.body;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypePayload: {
      accountName: "",
      clusterId: cluster,
    },
  };

  return await asyncUnaryCall(client, "submitJob", {
    cluster,
    userId: info.identityId,
    jobName,
    coreCount,
    gpuCount,
    maxTime,
    maxTimeUnit,
    nodeCount,
    partition,
    qos,
    account,
    command,
    memory,
    comment,
    workingDirectory,
    output,
    errorOutput,
    scriptOutput: scriptOutput === undefined || scriptOutput.trim() === "" ? undefined : scriptOutput.trim(),
    saveAsTemplate: save,
  })
    .then(async ({ jobId }) => {
      await callLog(
        {
          ...logInfo,
          operationTypeName: OperationType.submitJob,
          operationTypePayload: { ...logInfo.operationTypePayload, jobId },
        },
        OperationResult.SUCCESS,
      );
      if (save) {
        await callLog(
          {
            ...logInfo,
            operationTypeName: OperationType.addJobTemplate,
            operationTypePayload: { ...logInfo.operationTypePayload, jobTemplateId: `${jobName}-${jobId}` },
          },
          OperationResult.SUCCESS,
        );
      }
      return { 201: { jobId } } as const;
    })
    .catch(
      handlegRPCError(
        {
          [status.INTERNAL]: (err) => ({ 500: { code: "SCHEDULER_FAILED", message: err.details } }) as const,
          [status.INVALID_ARGUMENT]: (err) => ({
            400: { code: "INVALID_ARGUMENT" as const, message: err.details },
          }),
          [status.PERMISSION_DENIED]: (err) => {
            const { findDetails } = parseErrorStatus(err.metadata);
            const errors = findDetails(ErrorInfo);
            if (errors[0]) {
              switch (errors[0].reason) {
                case "USER_ACCOUNT_NOT_AVAILABLE":
                  return { 403: { code: "USER_ACCOUNT_NOT_AVAILABLE" as const, message: err.details } };
                case "CLUSTER_PARTITION_NOT_AVAILABLE":
                  return { 403: { code: "CLUSTER_PARTITION_NOT_AVAILABLE" as const, message: err.details } };
                default:
                  return { 403: { code: "PERMISSION_DENIED" as const, message: err.details } };
              }
            }
          },
          [status.NOT_FOUND]: (err) => ({ 404: { code: "NOT_FOUND", message: err.details } }) as const,
          [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
        },
        async () =>
          await callLog(
            {
              ...logInfo,
              operationTypeName: OperationType.submitJob,
              operationTypePayload: { ...logInfo.operationTypePayload },
            },
            OperationResult.FAIL,
          ),
      ),
    );
});
