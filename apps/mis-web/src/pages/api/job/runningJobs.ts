import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { GetRunningJobsRequest, JobServiceClient } from "@scow/protos/build/server/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { Money } from "src/models/UserSchemaModel";
import { getAuthorizedJobQuery } from "src/server/jobQueryAuthorization";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use RunningJob from protos
export const RunningJob = Type.Object({
  jobId: Type.String(),
  partition: Type.String(),
  name: Type.String(),
  user: Type.String(),
  userName: Type.Optional(Type.String()),
  state: Type.String(),
  runningTime: Type.String(),
  nodes: Type.String(),
  nodesOrReason: Type.String(),
  account: Type.String(),
  accountOwnerId: Type.Optional(Type.String()),
  accountOwnerName: Type.Optional(Type.String()),
  tenantName: Type.Optional(Type.String()),
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
  chargingPeriod: Type.Optional(
    Type.Object({
      startTime: Type.Optional(Type.String()),
      endTime: Type.Optional(Type.String()),
    }),
  ),
});
export type RunningJob = Static<typeof RunningJob>;

export const GetRunningJobsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
      如果是租户管理员，只看当前租户的
      如果userId是自己，或者（设置了accountName，而且当前用户是accountName账户的管理员或者主管理员），那么
        显示userId用户在accountName中的作业
      否则：403
     */
    userId: Type.Optional(Type.String()),
    userIdOrName: Type.Optional(Type.String()),
    ownerIdOrName: Type.Optional(Type.String()),
    accountName: Type.Optional(Type.String()),
    tenantName: Type.Optional(Type.String()),

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

export default /* #__PURE__*/ route(GetRunningJobsSchema, async (req, res) => {
  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, userId, userIdOrName, ownerIdOrName, accountName, tenantName } = req.query;
  const authorizedQuery = getAuthorizedJobQuery(info, { accountName, tenantName, userId });

  if (!authorizedQuery) {
    return { 403: null };
  }

  const filter: GetRunningJobsRequest = {
    cluster,
    jobIdList: [],
    userIdOrName,
    ownerIdOrName,
    tenantName: authorizedQuery.tenantName,
    userId: authorizedQuery.userId,
    accountName: authorizedQuery.accountName,
  };
  const results = await getRunningJobs(filter);

  return {
    200: { results },
  };
});
