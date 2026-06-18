import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { config } from "src/server/config/env";
import { AiJobSubmitRecord } from "src/server/entities/AiJobSubmitRecord";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, checkEntityAuth, hasNonUtf8Segment } from "src/server/utils/app";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { AIJobLabelType, validateMaxRunningTimeMinutes } from "src/server/utils/maxRunningTime";
import { fetchSubmitRecord } from "src/server/utils/submitRecord";
import { validateSubmitAiJobInfoUnderMis } from "src/server/utils/validation";
import { getIdPrivate } from "src/utils/app";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";
import { driver } from "../../Driver";
import { clusters } from "../config";
import { EnvVariableSchema, IdPrivateSchema, MAX_JOB_NAME_LENGTH } from "./jobs";

// 分布式训练框架
export const Framework = z.union([z.literal("tensorflow"), z.literal("pytorch"), z.literal("mindspore")]);

export type FrameworkType = z.infer<typeof Framework>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
});

export type Image = z.infer<typeof ImageSchema>;

export interface SessionMetadata {
  sessionId: string;
  jobName: string;
  jobId: number;
  submitTime: string;
  image: Image;
  jobType: JobType;
  containerServicePort: number;
}

export const InferenceJobInputSchema = z.object({
  clusterId: z.string(),
  InferenceJobName: z.string(),
  image: z.number().optional(),
  isImagePrivate: z.boolean().optional(),
  // 提交时选择的本地镜像的名称,用于详情展示
  localImageName: z.string().optional(),
  remoteImageUrl: z.string().optional(),
  models: z.array(IdPrivateSchema).optional(),
  mountPoints: z
    .array(
      z.object({
        path: z.string(),
        target: z.string(),
      }),
    )
    .optional(),
  account: z.string(),
  partition: z.string().optional(),
  qos: z.string().optional(),
  coreCount: z.number(),
  nodeCount: z.number(),
  gpuCount: z.number().optional(),
  memory: z.number().optional(),
  maxTime: z.number(),
  command: z.string(),
  gpuType: z.string().optional(),
  // 容器内服务端口
  containerServicePort: z.number(),
  envVariables: z.array(EnvVariableSchema).optional(),
  privateImageRepositoryCredentials: z
    .object({
      userName: z.string(),
      password: z.string(),
    })
    .optional(),
});

export type InferenceJobInput = z.infer<typeof InferenceJobInputSchema>;

export const InferSubmitRecordFormDataSchema = InferenceJobInputSchema.omit({
  clusterId: true,
  account: true,
  privateImageRepositoryCredentials: true,
});

export const submitInferJob = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/infer",
      tags: ["infer"],
      summary: "Submit A Inference Job",
    },
  })
  .input(InferenceJobInputSchema)
  .output(
    z.object({
      jobId: z.number(),
    }),
  )
  .use(async ({ input: { clusterId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createAiInferenceJob,
    };

    if (res.ok) {
      await callLog(
        { ...logInfo, operationTypePayload: { clusterId, jobId: (res.data as any).jobId } },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload: { clusterId } }, OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    if (aiConfig.inferConfig?.enabled === false) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "AI inference function is not enabled.",
      });
    }

    const { clusterId, InferenceJobName, image, models, account, partition, mountPoints, maxTime } = input;
    const { ids: modelIds, isPrivates: isModelPrivates, targets: modelTargets } = getIdPrivate(models);

    if (InferenceJobName.length > MAX_JOB_NAME_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `The length of InferenceJobName should not exceed ${MAX_JOB_NAME_LENGTH}`,
      });
    }

    const inferMaxRunningTimeHours = clusters[clusterId]?.ai.infer?.maxRunningTimeHours;
    if (maxTime === 0 && inferMaxRunningTimeHours !== undefined) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `The infer running time cannot be unlimited because the current cluster has configured a max running time ` +
          `of ${inferMaxRunningTimeHours} hour${inferMaxRunningTimeHours > 1 ? "s" : ""}`,
      });
    }

    // 推理时间不限制时，maxTime 为 0, 不进行已配置的最长运行时间校验
    if (maxTime !== 0) {
      validateMaxRunningTimeMinutes(maxTime, inferMaxRunningTimeHours, AIJobLabelType.infer);
    }

    if (mountPoints?.some((mountPoint) => hasNonUtf8Segment(mountPoint.path))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Files or folders with non-UTF-8 names cannot be selected",
      });
    }

    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    // 管理系统存在时，增加用户账户封锁状态，授权集群分区等鉴权
    if (config.MIS_DEPLOYED) {
      await validateSubmitAiJobInfoUnderMis({
        userId,
        accountName: account,
        clusterId,
        logger,
        partitionName: partition,
        checkAccountApp: false,
      });
    }

    const em = await forkEntityManager();
    const { modelVersions, image: existImage } = await checkCreateAppEntity({
      em,
      datasets: undefined,
      algorithms: undefined,
      image,
      models: modelIds,
    });

    // 检查数据集、算法、模型和镜像是否有权限使用
    checkEntityAuth({
      algorithmVersions: [],
      datasetVersions: [],
      modelVersions,
      image: existImage,
      userId,
    });
    const modelVersionsWithTarget = modelVersions.map((v, i) => ({ ...v, target: modelTargets[i] ?? "" }));

    const jobId = await driver.withJobDriver(
      {
        clusterId,
        user: userId,
      },
      async (jobDriver) => {
        return await jobDriver.submitInferJob(input, {
          isModelPrivates,
          modelVersions: modelVersionsWithTarget,
          existImage,
        });
      },
      logger,
    );

    const { clusterId: _cid, account: _acc, privateImageRepositoryCredentials: _cred, ...rawFormData } = input;
    const parsedFormData = InferSubmitRecordFormDataSchema.safeParse(rawFormData);
    if (!parsedFormData.success) {
      logger.warn("Failed to parse infer form data for jobId %s: %o", jobId, parsedFormData.error);
    } else {
      try {
        await em.persistAndFlush(
          new AiJobSubmitRecord({
            userId,
            jobType: JobType.INFER,
            jobId,
            cluster: clusterId,
            account,
            formData: parsedFormData.data,
          }),
        );
      } catch (e) {
        logger.warn("Failed to save infer job submit record for jobId %s: %o", jobId, e);
      }
    }

    return { jobId };
  });

export const getSubmitInferenceParams = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/infer/{jobId}/submissionParameters",
      tags: ["jobs"],
      summary: "Get Submit Infer Job Parameters",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
    }),
  )
  .output(InferenceJobInputSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, jobId, sessionId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const em = await forkEntityManager();
    return fetchSubmitRecord(
      em,
      userId,
      clusterId,
      jobId,
      InferenceJobInputSchema,
      () => driver.withJobDriver({ clusterId, user: userId }, (d) => d.getInferParams(sessionId, jobId), logger),
      logger,
    );
  });
