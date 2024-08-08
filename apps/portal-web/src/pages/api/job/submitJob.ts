/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

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
  scriptOutput:Type.Optional(Type.String()),
  maxTimeUnit:Type.Optional(Type.Enum(TimeUnit)),
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
      message: Type.String(),
    }),

    404: Type.Object({
      code: Type.Literal("NOT_FOUND"),
      message: Type.String(),
    }),

    409: Type.Object({
      code: Type.Literal("ALREADY_EXISTS"),
      message: Type.String(),
    }),

    500: Type.Object({
      code: Type.Literal("SCHEDULER_FAILED"),
      message: Type.String(),
    }),
  },
});

const auth = authenticate(() => true);

export default route(SubmitJobSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, command, jobName, coreCount, gpuCount, maxTime, maxTimeUnit, save,
    nodeCount, partition, qos, account, comment
    , workingDirectory, output, errorOutput, scriptOutput, memory } = req.body;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypePayload:{
      accountName: account,
      clusterId: cluster,
    },
  };

  return await asyncUnaryCall(client, "submitJob", {
    cluster, userId: info.identityId,
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
    scriptOutput:scriptOutput === undefined || scriptOutput.trim() === "" ? undefined : scriptOutput.trim(),
    saveAsTemplate: save,
  })
    .then(async ({ jobId }) => {
      await callLog(
        { ...logInfo,
          operationTypeName: OperationType.submitJob,
          operationTypePayload: { ... logInfo.operationTypePayload, jobId } },
        OperationResult.SUCCESS,
      );
      if (save) {
        await callLog(
          {
            ...logInfo,
            operationTypeName: OperationType.addJobTemplate,
            operationTypePayload: { ... logInfo.operationTypePayload, jobTemplateId: `${jobName}-${jobId}` },
          },
          OperationResult.SUCCESS,
        );
      }
      return { 201: { jobId } } as const;
    })
    .catch(handlegRPCError({
      [status.INTERNAL]: (err) => ({ 500: { code: "SCHEDULER_FAILED", message: err.details } } as const),
      [status.NOT_FOUND]: (err) => ({ 404: { code: "NOT_FOUND", message: err.details } } as const),
      [status.ALREADY_EXISTS]: (err) => ({ 409: { code: "ALREADY_EXISTS", message: err.details } } as const),
    },
    async () => await callLog(
      { ...logInfo,
        operationTypeName: OperationType.submitJob,
        operationTypePayload: { ... logInfo.operationTypePayload },
      },
      OperationResult.FAIL,
    )));
});
