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
import { ServiceError } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { parseErrorDetails } from "@scow/rich-error-model";
import { Type } from "@sinclair/typebox";
import { join } from "path";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const CreateAppSessionSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    appId: Type.String(),
    appJobName: Type.String(),
    account: Type.String(),
    partition: Type.Optional(Type.String()),
    qos: Type.Optional(Type.String()),
    coreCount: Type.Number(),
    nodeCount: Type.Number(),
    gpuCount: Type.Optional(Type.Number()),
    memory: Type.Optional(Type.String()),
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

    404: Type.Object({
      code: Type.Literal("APP_NOT_FOUND"),
      message: Type.String(),
    }),

    409: Type.Object({
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
    appId, appJobName, cluster, coreCount, nodeCount, gpuCount, memory,
    partition, qos, account, maxTime, customAttributes,
  } = req.body;

  const client = getClient(AppServiceClient);

  const proxyBasePath = join(publicConfig.BASE_PATH, "/api/proxy", cluster);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createApp,
    operationTypePayload:{
      accountName: account, clusterId: cluster,
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
    memory,
    account,
    maxTime,
    partition,
    qos,
    proxyBasePath,
    customAttributes,
  }).then(async (reply) => {
    await callLog({
      ...logInfo,
      operationTypePayload: { ... logInfo.operationTypePayload, jobId: reply.jobId },
    }, OperationResult.SUCCESS);
    return { 200: { jobId: reply.jobId, sessionId: reply.sessionId } };
  }).catch(async (e) => {
    await callLog({
      ...logInfo,
      operationTypePayload: { ... logInfo.operationTypePayload },
    }, OperationResult.FAIL);
    const ex = e as ServiceError;
    const errors = parseErrorDetails(ex.metadata);
    if (errors[0] && errors[0].$type === "google.rpc.ErrorInfo") {
      switch (errors[0].reason) {
      case "SBATCH_FAILED":
        return { 409: { code: "SBATCH_FAILED" as const, message: ex.details } };
      case "NOT FOUND":
        return { 404: { code: "APP_NOT_FOUND" as const, message: ex.details } };
      case "INVALID ARGUMENT":
        return { 400: { code: "INVALID_INPUT" as const, message: ex.details } };
      default:
        return e;
      }
    } else {
      throw e;
    }
  });
});
