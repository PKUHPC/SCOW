import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient, ListAllJobsRequest_TimeType } from "@scow/protos/build/portal/job";
import { jobStates } from "@scow/utils";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use JobInfo from protos
export const JobInfo = Type.Object({
  jobId: Type.Number(),
  name: Type.String(),
  account: Type.String(),
  partition: Type.String(),
  qos: Type.String(),
  state: Type.String(),
  workingDirectory: Type.String(),
  reason: Type.String(),
  elapsed: Type.String(),
  timeLimit: Type.String(),
  submitTime: Type.String(),
  startTime: Type.Optional(Type.String()),
  endTime: Type.Optional(Type.String()),
  nodes: Type.Number(),
  cores: Type.Number(),
  gpus: Type.Number(),
  cpusAlloc: Type.Number(),
  nodesAlloc: Type.Number(),
  gpusAlloc: Type.Number(),
  memReq: Type.Number(),
  memAlloc: Type.Number(),
  nodelist: Type.Optional(Type.String()),
});

export type JobInfo = Static<typeof JobInfo>;

export const GetAllJobsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    startTime: Type.String(),
    endTime: Type.String(),
    timeType: Type.Optional(Type.Union([Type.Literal("submitTime"), Type.Literal("endTime")])),
    jobId: Type.Optional(Type.Integer({ minimum: 1, maximum: 0xffffffff })),
    jobName: Type.Optional(Type.String()),
    account: Type.Optional(Type.String()),
    state: Type.Optional(Type.Union([Type.Literal("ALL"), ...jobStates.map((state) => Type.Literal(state))])),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(JobInfo),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetAllJobsSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, startTime, endTime, timeType, jobId, jobName, account, state } = req.query;

  const client = getClient(JobServiceClient);

  return asyncUnaryCall(client, "listAllJobs", {
    userId: info.identityId,
    cluster,
    startTime,
    endTime,
    account: account?.trim() || undefined,
    states: state && state !== "ALL" ? [state] : [],
    jobId,
    jobName: jobName?.trim() || undefined,
    timeType: timeType === "endTime" ? ListAllJobsRequest_TimeType.END_TIME : ListAllJobsRequest_TimeType.SUBMIT_TIME,
  }).then(({ results }) => ({
    200: {
      results: results.map((job) => ({
        ...job,
        cpusAlloc: job.cpusAlloc ?? 0,
        gpusAlloc: job.gpusAlloc ?? 0,
        nodesAlloc: job.nodesAlloc ?? 0,
        memReq: job.memReq,
        memAlloc: job.memAlloc ?? 0,
      })),
    },
  }));
});
