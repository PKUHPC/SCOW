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
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { JobServiceClient } from "@scow/protos/build/server/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { checkJobAccessible } from "src/server/jobAccessible";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { publicConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export type ChangeMode =
  | "INCREASE"
  | "DECREASE"

// 修改作业运行时限。
// 只有平台管理员、租户管理员、或者作业发起者本人、或者作业发起者所在账户的管理员或者拥有者可以修改
export const ChangeJobTimeLimitSchema = typeboxRouteSchema({
  method: "PATCH",

  body: Type.Object({
    cluster: Type.String(),

    jobId: Type.String(),

    /**
     * 新的作业运行时限
     * @type integer
     */
    limitMinutes: Type.Integer(),
  }),

  responses: {
    204: Type.Null(),
    /** 用户不能修改这个作业的时限 */
    403: Type.Null(),
    /** 作业未找到 */
    404: Type.Null(),
    /** 用户设置的时限错误 */
    400: Type.Object({ code: Type.Literal("TIME_LIME_NOT_VALID") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(ChangeJobTimeLimitSchema,
  async (req, res) => {
    const info = await auth(req, res);
    if (!info) { return; }

    const { cluster, limitMinutes, jobId } = req.body;

    const client = getClient(JobServiceClient);

    // check if the user can change the job time limit
    const { job, jobAccessible } = await checkJobAccessible({
      actionType: "changeJobLimit",
      jobId,
      cluster,
      info,
      limitMinutes,
      allowUser: publicConfig.CHANGE_JOB_LIMIT.allowUser,
    });

    if (jobAccessible === "NotAllowed") {
      return { 403: null };
    } else if (jobAccessible === "NotFound") {
      return { 404: null };
    } else if (jobAccessible === "LimitNotValid") {
      return {
        400: {
          code: "TIME_LIME_NOT_VALID" as const,
        },
      };
    }

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.setJobTimeLimit,
      operationTypePayload:{
        jobId: +jobId, accountName: job.account, limitMinutes, clusterId: cluster,
      },
    };

    return await asyncClientCall(client, "changeJobTimeLimit", {
      cluster,
      limitMinutes,
      jobId,
    })
      .then(async () => {
        await callLog(logInfo, OperationResult.SUCCESS);
        return { 204: null };
      })
      .catch(handlegRPCError({
        [Status.NOT_FOUND]: () => ({ 404: null }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
      ));
  });
