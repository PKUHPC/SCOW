import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import {
  GetJobsRequest,
  GetJobsResponse,
  JobType as SchedulerAdapterJobType,
} from "@scow/scheduler-adapter-protos/build/job";

export const allSchedulerAdapterAiJobTypes = [
  SchedulerAdapterJobType.JOB_TYPE_APP,
  SchedulerAdapterJobType.JOB_TYPE_TRAIN,
  SchedulerAdapterJobType.JOB_TYPE_INFER,
  SchedulerAdapterJobType.JOB_TYPE_DEV_HOST,
];

export const getSchedulerAdapterJobTypesByClusterFeatures = (
  clusterConfig: ClusterConfigSchema,
): SchedulerAdapterJobType[][] => [
  ...(clusterConfig.hpc.enabled ? [[]] : []),
  ...(clusterConfig.ai.enabled ? [allSchedulerAdapterAiJobTypes] : []),
];

export const mergeSchedulerAdapterGetJobsResponses = (responses: GetJobsResponse[]): GetJobsResponse => ({
  jobs: responses.flatMap((x) => x.jobs),
  totalCount:
    responses.some((x) => x.totalCount !== undefined)
      ? responses.reduce((prev, curr) => prev + (curr.totalCount ?? curr.jobs.length), 0)
      : undefined,
});

export const getSchedulerAdapterJobsByClusterFeatures = async (
  client: SchedulerAdapterClient,
  clusterConfig: ClusterConfigSchema,
  request: Omit<GetJobsRequest, "jobTypes">,
) => {
  const responses = await Promise.all(
    getSchedulerAdapterJobTypesByClusterFeatures(clusterConfig).map(async (jobTypes) =>
      await asyncClientCall(client.job, "getJobs", { ...request, jobTypes }),
    ),
  );

  return mergeSchedulerAdapterGetJobsResponses(responses);
};
