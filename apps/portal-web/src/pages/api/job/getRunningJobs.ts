import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
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
});

export type RunningJob = Static<typeof RunningJob>;

export const GetRunningJobsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    userId: Type.String(),

    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(RunningJob),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetRunningJobsSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, userId } = req.query;

  const client = getClient(JobServiceClient);

  return asyncUnaryCall(client, "listRunningJobs", {
    cluster,
    userId,
  }).then(({ results }) => ({
    200: {
      results: results.map((job) => ({
        ...job,
        cpusAlloc: job.cpusAlloc ?? 0,
        gpusAlloc: job.gpusAlloc ?? 0,
        nodesAlloc: job.nodesAlloc ?? 0,
        memReq: job.memReq,
        memAlloc: job.memAlloc ?? 0,
        submitTime: job.submissionTime,
      })),
    },
  }));
});
