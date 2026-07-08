import { AppConfigSchema } from "@scow/config/build/appForAi";
import { AppType } from "@scow/scheduler-adapter-protos/build/app";
import { JobInfo, JobType as ProtoJobType } from "@scow/scheduler-adapter-protos/build/job";
import { TRPCError } from "@trpc/server";
import { clusters } from "src/server/config/clusters";
import { AlgorithmVersion } from "src/server/entities/AlgorithmVersion";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { Image as ImageEntity } from "src/server/entities/Image";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { CreateDevHostInput } from "src/server/trpc/route/devHost/devHost";
import { AppSession, CreateAppInput } from "src/server/trpc/route/jobs/apps";
import { InferenceJobInput } from "src/server/trpc/route/jobs/infer";
import { TrainJobInput } from "src/server/trpc/route/jobs/jobs";
import { clusterNotFound } from "src/server/utils/errors";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { Logger } from "ts-log";

import { ScowdJobDriver } from "./scowdJobDriver";
import { SshJobDriver } from "./sshJobDriver";

type WithMountTarget<T> = T & { target: string };

export interface CreateAppExtraParams {
  isAlgorithmPrivates: boolean[];
  isDatasetPrivates: boolean[];
  isModelPrivates: boolean[];
  algorithmVersions: WithMountTarget<AlgorithmVersion>[];
  datasetVersions: WithMountTarget<DatasetVersion>[];
  modelVersions: WithMountTarget<ModelVersion>[];
  app: AppConfigSchema;
  proxyBasePath: string;
  existImage: ImageEntity | undefined
}

export interface ConnectToAppResponse {
  appId: string;
  host: string;
  port: number;
  password: string;
}

export interface SubmitInferJobExtraParams {
  isModelPrivates: boolean[];
  modelVersions: WithMountTarget<ModelVersion>[];
  existImage: ImageEntity | undefined
}

export interface SubmitTrainJobExtraParams {
  isAlgorithmPrivates: boolean[];
  isDatasetPrivates: boolean[];
  isModelPrivates: boolean[];
  algorithmVersions: WithMountTarget<AlgorithmVersion>[];
  datasetVersions: WithMountTarget<DatasetVersion>[];
  modelVersions: WithMountTarget<ModelVersion>[];
  existImage: ImageEntity | undefined
}

export interface CreateDevHostExtraParams {
  existImage: ImageEntity | undefined
}

export interface AiJobsQueryOptions {
  page?: number;
  pageSize?: number;
  jobName?: string;
  sortField?: "job_id" | "submit_time" | "end_time";
  sortOrder?: "ASC" | "DESC";
}

export interface AiJobsResult {
  sessions: AppSession[];
  count: number;
}

export const sortSessionsByJobOrder = (sessions: AppSession[], jobsInfo: JobInfo[]) => {
  const jobOrderMap = jobsInfo.reduce(
    (prev, curr, index) => {
      prev[curr.jobId] = index;
      return prev;
    },
    {} as Record<number, number>,
  );

  return [...sessions].sort(
    (a, b) =>
      (jobOrderMap[a.jobId] ?? Number.MAX_SAFE_INTEGER) - (jobOrderMap[b.jobId] ?? Number.MAX_SAFE_INTEGER),
  );
};

export interface JobDriver {
  createApp(inputParams: CreateAppInput, extraParams: CreateAppExtraParams): Promise<number>;
  getAppParams(sessionId: string, jobId: number): Promise<CreateAppInput>;
  getAiJobs(
    clusterId: string,
    isRunning?: boolean,
    jobTypes?: ProtoJobType[],
    options?: AiJobsQueryOptions,
  ): Promise<AiJobsResult>;
  connectToApp(clusterId: string, sessionId: string, appType?: AppType): Promise<ConnectToAppResponse>;
  submitInferJob(inputParams: InferenceJobInput, extraParams: SubmitInferJobExtraParams): Promise<number>;
  getInferParams(sessionId: string, jobId: number): Promise<InferenceJobInput>;
  submitTrainJob(inputParams: TrainJobInput, extraParams: SubmitTrainJobExtraParams): Promise<number>;
  getTrainParams(sessionId: string, jobId: number): Promise<TrainJobInput>;
  createDevHost(inputParams: CreateDevHostInput, extraParams: CreateDevHostExtraParams): Promise<number>;
  getDevHostParams(sessionId: string, jobId: number): Promise<CreateDevHostInput>;
}

function createJobDriver(opts: {
  clusterId: string;
  userId: string;
  logger: Logger;
}): JobDriver {
  const { clusterId, userId, logger } = opts;
  const cluster = clusters[clusterId];
  const host = getClusterLoginNode(clusterId);

  if (!cluster) {
    throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
  }

  if (!host) { throw clusterNotFound(clusterId); }

  if (cluster.scowd?.enabled) {
    return new ScowdJobDriver(clusterId, userId, logger);
  }

  return new SshJobDriver(host, userId, logger);
}


export async function withJobDriver<T>(
  params: {
    clusterId: string;
    user: string;
  },
  handler: (driver: JobDriver) => Promise<T>,
  logger: Logger,
) {

  const driver = createJobDriver({
    clusterId: params.clusterId,
    userId: params.user,
    logger,
  });

  try {
    return await handler(driver);
  } catch (err) {
    logger.error(`Error in job operation, executing handler ${err as any}`);
    throw err;
  }
}
