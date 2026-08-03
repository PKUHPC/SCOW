import { AppConfigSchema } from "@scow/config/build/appForAi";
import { AppType } from "@scow/scheduler-adapter-protos/build/app";
import { JobType as ProtoJobType } from "@scow/scheduler-adapter-protos/build/job";
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
import { clusterBackendNotSupported } from "src/server/utils/errors";
import { Logger } from "ts-log";

import { ScowdJobDriver } from "./scowdJobDriver";

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
  existImage: ImageEntity | undefined;
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
  existImage: ImageEntity | undefined;
}

export interface SubmitTrainJobExtraParams {
  isAlgorithmPrivates: boolean[];
  isDatasetPrivates: boolean[];
  isModelPrivates: boolean[];
  algorithmVersions: WithMountTarget<AlgorithmVersion>[];
  datasetVersions: WithMountTarget<DatasetVersion>[];
  modelVersions: WithMountTarget<ModelVersion>[];
  existImage: ImageEntity | undefined;
}

export interface CreateDevHostExtraParams {
  existImage: ImageEntity | undefined;
}

export interface JobDriver {
  createApp(inputParams: CreateAppInput, extraParams: CreateAppExtraParams): Promise<number>;
  getAppParams(sessionId: string, jobId: number): Promise<CreateAppInput>;
  getAiJobs(clusterId: string, isRunning?: boolean, jobTypes?: ProtoJobType[]): Promise<AppSession[]>;
  connectToApp(clusterId: string, sessionId: string, appType?: AppType): Promise<ConnectToAppResponse>;
  submitInferJob(inputParams: InferenceJobInput, extraParams: SubmitInferJobExtraParams): Promise<number>;
  getInferParams(sessionId: string, jobId: number): Promise<InferenceJobInput>;
  submitTrainJob(inputParams: TrainJobInput, extraParams: SubmitTrainJobExtraParams): Promise<number>;
  getTrainParams(sessionId: string, jobId: number): Promise<TrainJobInput>;
  createDevHost(inputParams: CreateDevHostInput, extraParams: CreateDevHostExtraParams): Promise<number>;
  getDevHostParams(sessionId: string, jobId: number): Promise<CreateDevHostInput>;
}

interface JobDriverProvider {
  supports(clusterId: string): boolean;
  create(opts: { clusterId: string; userId: string; logger: Logger }): JobDriver;
}

// 后续新增作业driver时在这里注册 provider，不要在 route 中增加分支。
// supports() 只应在集群明确启用对应后端时返回 true，create() 必须返回完整的 JobDriver 实现。
// provider 会按顺序匹配；如果新driver优先级高于 scowd，请放在 scowd 前面。
const jobDriverProviders: JobDriverProvider[] = [
  {
    supports: (clusterId) => clusters[clusterId]?.scowd?.enabled === true,
    create: ({ clusterId, userId, logger }) => new ScowdJobDriver(clusterId, userId, logger),
  },
];

function createJobDriver(opts: { clusterId: string; userId: string; logger: Logger }): JobDriver {
  const { clusterId, userId, logger } = opts;
  const cluster = clusters[clusterId];

  if (!cluster) {
    throw new TRPCError({ code: "NOT_FOUND", message: "cluster is not found" });
  }

  const provider = jobDriverProviders.find((provider) => provider.supports(clusterId));
  if (!provider) {
    throw clusterBackendNotSupported(clusterId);
  }

  return provider.create({ clusterId, userId, logger });
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
