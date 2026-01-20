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
import { GetRunningJobsRequest, JobServiceClient } from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { Money } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use RunningJob from protos
export const RunningJob = Type.Object({
  jobId: Type.String(),
  partition: Type.String(),
  name: Type.String(),
  user: Type.String(),
  state: Type.String(),
  runningTime: Type.String(),
  nodes: Type.String(),
  nodesOrReason: Type.String(),
  account: Type.String(),
  cores: Type.String(),
  gpus: Type.String(),
  qos: Type.String(),
  submissionTime: Type.String(),
  /**
   * days-hours:minutes:seconds.
   * The value may be  "NOT_SET"  if not yet established or "UNLIMITED" for no
   * limit.  (Valid for jobs and job steps)
   */
  timeLimit: Type.String(),
  workingDir: Type.String(),
  cpusAlloc: Type.Number(),
  nodesAlloc: Type.Number(),
  gpusAlloc: Type.Number(),
  memReq: Type.Number(),
  memAlloc: Type.Number(),
  startTime: Type.Optional(Type.String()),
  endTime: Type.Optional(Type.String()),
  nodelist: Type.Optional(Type.String()),
  reason: Type.Optional(Type.String()),
  submitTime: Type.String(),
  accountPrice: Type.Optional(Money),
  tenantPrice: Type.Optional(Money),
  chargingPeriod: Type.Optional(Type.Object({
    startTime: Type.Optional(Type.String()),
    endTime: Type.Optional(Type.String()),
  })),
});
export type RunningJob = Static<typeof RunningJob>;

export const GetRunningJobsSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({

    /**
      如果是租户管理员，只看当前租户的
      如果userId是自己，或者（设置了accountName，而且当前用户是accountName账户的管理员或者拥有者），那么
        显示userId用户在accountName中的作业
      否则：403
     */
    userId: Type.Optional(Type.String()),
    accountName: Type.Optional(Type.String()),

    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(RunningJob),
    }),


    403: Type.Null(),
  },
});

export const getRunningJobs = async (request: GetRunningJobsRequest) => {

  const client = getClient(JobServiceClient);

  const reply = await asyncClientCall(client, "getRunningJobs", request);

  return reply.jobs.map((job) => ({
    ...job,
    cpusAlloc: job.cpusAlloc ?? 0,
    gpusAlloc: job.gpusAlloc ?? 0,
    nodesAlloc: job.nodesAlloc ?? 0,
    memReq: job.memReq,
    memAlloc: job.memAlloc ?? 0,
    submitTime: job.submissionTime,
  }));
};


export default /* #__PURE__*/route(GetRunningJobsSchema, async (req, res) => {
  const auth = authenticate((u) =>
    // u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
    u.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
    u.accountAffiliations.length > 0);

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, userId, accountName } = req.query;

  const filter: GetRunningJobsRequest = {
    cluster,
    jobIdList: [],
  };

  if (info.tenantRoles.includes(TenantRole.TENANT_ADMIN)
    || userId === info.identityId
    || (accountName && info.accountAffiliations.find((x) => x.accountName === accountName))
  ) {
    filter.tenantName = info.tenantRoles.includes(TenantRole.TENANT_ADMIN) ? info.tenant : undefined;
    filter.userId = userId;
    filter.accountName = accountName;
  } else {
    return { 403: null };
  }

  const results = await getRunningJobs(filter);

  return {
    200: { results },
  };
});
