import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import { Type } from "@sinclair/typebox";
import { join } from "path";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CreateAppSessionSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    appId: Type.String(),
    appName: Type.String(),
    appJobName: Type.String(),
    account: Type.String(),
    partition: Type.Optional(Type.String()),
    qos: Type.Optional(Type.String()),
    coreCount: Type.Number(),
    nodeCount: Type.Number(),
    gpuCount: Type.Optional(Type.Number()),
    memoryMb: Type.Optional(Type.Number()),
    maxTime: Type.Number(),
    customAttributes: Type.Record(Type.String(), Type.String()),
  }),

  responses: {
    200: Type.Object({
      jobId: Type.Number(),
      sessionId: Type.String(),
    }),

    400: Type.Object({
      code: Type.Literal("INVALID_INPUT"),
      message: Type.String(),
    }),

    403: Type.Object({
      code: Type.Union([
        Type.Literal("APP_NOT_AVAILABLE"),
        Type.Literal("USER_ACCOUNT_NOT_AVAILABLE"),
        Type.Literal("CLUSTER_PARTITION_NOT_AVAILABLE"),

      ]),
      message: Type.String(),
    }),
    404: Type.Object({
      code: Type.Literal("APP_NOT_FOUND"),
      message: Type.String(),
    }),

    429: Type.Object({ code: Type.Literal("NO_SPACE") }),

    500: Type.Object({
      code: Type.Literal("SBATCH_FAILED"),
      message: Type.String(),
    }),

  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(CreateAppSessionSchema, async (req, res) => {


  const info = await auth(req, res);

  if (!info) { return; }

  const {
    appId, appName, appJobName, cluster, coreCount, nodeCount, gpuCount, memoryMb,
    partition, qos, account, maxTime, customAttributes,
  } = req.body;

  const client = getClient(AppServiceClient);

  const proxyBasePath = join(publicConfig.BASE_PATH, "/api/proxy", cluster);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createApp,
    operationTypePayload:{
      accountName: "", clusterId: cluster, appName,
    },
  };

  return await asyncUnaryCall(client, "createAppSession", {
    appId,
    appJobName,
    cluster,
    userId: info.identityId,
    coreCount,
    nodeCount,
    gpuCount,
    memoryMb,
    account,
    maxTime,
    partition,
    qos,
    proxyBasePath,
    customAttributes,
  }).then(async (reply) => {
    await callLog({
      ...logInfo,
      operationTypePayload: { ...logInfo.operationTypePayload, jobId: reply.jobId },
    }, OperationResult.SUCCESS);
    return { 200: { jobId: reply.jobId, sessionId: reply.sessionId } };
  }, handlegRPCError({
    [status.RESOURCE_EXHAUSTED]: () => ({ 429: { code: "NO_SPACE" as const } }),
  },
  async () => await callLog(logInfo, OperationResult.FAIL),
  )).catch(async (e) => {
    await callLog(logInfo, OperationResult.FAIL);
    const ex = e as ServiceError;

    const { findDetails } = parseErrorStatus(ex.metadata);

    const errors = findDetails(ErrorInfo);

    if (errors[0]) {
      switch (errors[0].reason) {
        case "SBATCH_FAILED":
          return { 500: { code: "SBATCH_FAILED" as const, message: ex.details } };
        case "INVALID ARGUMENT":
          return { 400: { code: "INVALID_INPUT" as const, message: ex.details } };
        case "APP_NOT_FOUND":
          return { 404: { code: "APP_NOT_FOUND" as const, message: ex.details } };
        case "APP_NOT_AVAILABLE":
        case "APP_NOT_PROVIDED":
          return { 403: { code: "APP_NOT_AVAILABLE" as const, message: ex.details } };
        case "USER_ACCOUNT_NOT_AVAILABLE":
          return { 403: { code: "USER_ACCOUNT_NOT_AVAILABLE" as const, message: ex.details } };
        case "CLUSTER_PARTITION_NOT_AVAILABLE":
          return { 403: { code: "CLUSTER_PARTITION_NOT_AVAILABLE" as const, message: ex.details } };
        default:
          return e;
      }
    } else {
      throw e;
    }
  });
});
