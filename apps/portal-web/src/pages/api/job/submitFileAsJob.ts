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
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const SubmitFileAsJobSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    // 文件绝对路径
    filePath: Type.String(),
  }),

  responses: {
    201: Type.Object({
      jobId: Type.Number(),
    }),

    400: Type.Object({
      code: Type.Union([
        Type.Literal("INVALID_ARGUMENT"),
        Type.Literal("INVALID_PATH"),
      ]),
      message: Type.String(),
    }),

    500: Type.Object({
      code: Type.Union([
        Type.Literal("SCHEDULER_FAILED"),
        Type.Literal("FAILED_PRECONDITION"),
        Type.Literal("UNIMPLEMENTED"),
      ]),
      message: Type.String(),
    }),
  },
});

const auth = authenticate(() => true);

export default route(SubmitFileAsJobSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, filePath } = req.body;

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypePayload:{
      clusterId: cluster, path: filePath,
    },
  };

  return await asyncUnaryCall(client, "submitFileAsJob", {
    cluster, userId: info.identityId, filePath
    ,
  })
    .then(async ({ jobId }) => {
      await callLog(
        { ...logInfo,
          operationTypeName: OperationType.submitFileItemAsJob,
          operationTypePayload: { ... logInfo.operationTypePayload } },
        OperationResult.SUCCESS,
      );
      return { 201: { jobId } } as const;
    })
    .catch(handlegRPCError({
      [status.INTERNAL]: (err) => ({ 500: { code: "SCHEDULER_FAILED" as const, message: err.details } }),
      [status.FAILED_PRECONDITION]: () => ({ 500: {
        code: "FAILED_PRECONDITION" as const,
        message: "The method submitScriptAsJob is not supported with your current scheduler adapter version." } }),
      [status.UNIMPLEMENTED]: () => ({ 500: {
        code: "UNIMPLEMENTED" as const,
        message: "The scheduler API version can not be confirmed." } }),
      [status.INVALID_ARGUMENT]: (err) => ({ 400: { code: "INVALID_ARGUMENT" as const, message: err.details } }),
      [status.PERMISSION_DENIED]: (err) => ({ 400: { code: "INVALID_PATH" as const, message: err.details } }),
    },
    async () => await callLog(
      { ...logInfo,
        operationTypeName: OperationType.submitFileItemAsJob,
        operationTypePayload: { ... logInfo.operationTypePayload },
      },
      OperationResult.FAIL,
    )));
});
