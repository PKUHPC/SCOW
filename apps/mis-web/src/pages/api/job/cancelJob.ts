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
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { checkJobAccessible } from "src/server/jobAccessible";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CancelJobSchema = typeboxRouteSchema({
  method: "DELETE",

  query: Type.Object({
    cluster: Type.String(),
    jobId: Type.String(),
  }),

  responses: {
    204: Type.Null(),
    /** 用户不能结束这个作业 */
    403: Type.Null(),
    /** 作业未找到 */
    404: Type.Object({ code: Type.Literal("JOB_NOT_FOUND") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(CancelJobSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, jobId } = req.query;

  const { job, jobAccessible } = await checkJobAccessible({
    actionType: "cancelJob",
    jobId,
    cluster,
    info,
  });

  if (jobAccessible === "NotAllowed") {
    return { 403: null };
  } else if (jobAccessible === "NotFound") {
    return { 404: { code: "JOB_NOT_FOUND" } as const };
  }

  const client = getClient(JobServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.endJob,
    operationTypePayload: {
      jobId: +jobId, accountName: job.account, clusterId: cluster,
    },
  };

  // Cancel the job for the user who submitted the job
  return asyncUnaryCall(client, "cancelJob", {
    jobId: +jobId, userId: job.user, cluster,
  }).then(async () => {
    await callLog(logInfo, OperationResult.SUCCESS);
    return { 204: null };
  }, handlegRPCError({
    [status.NOT_FOUND]: () => ({ 404: { code: "JOB_NOT_FOUND" } } as const),
  },
  async () => await callLog(logInfo, OperationResult.FAIL),
  ));
});
