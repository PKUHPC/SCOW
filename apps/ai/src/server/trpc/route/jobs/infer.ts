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

import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { JobType } from "src/models/Job";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, checkEntityAuth } from "src/server/utils/app";
import { checkClusterAvailable } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { getIdPrivate } from "src/utils/app";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";
import { driver } from "../../Driver";
import { EnvVariableSchema, IdPrivateSchema } from "./jobs";

// 分布式训练框架
export const Framework = z.union([
  z.literal("tensorflow"),
  z.literal("pytorch"),
  z.literal("mindspore"),
]);

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
  remoteImageUrl: z.string().optional(),
  models: z.array(IdPrivateSchema),
  mountPoints: z.array(z.string()).optional(),
  account: z.string(),
  partition: z.string().optional(),
  qos:z.string().optional(),
  coreCount: z.number(),
  nodeCount: z.number(),
  gpuCount: z.number().optional(),
  memory: z.number().optional(),
  maxTime: z.number(),
  command: z.string(),
  gpuType: z.string().optional(),
  // 容器内服务端口
  containerServicePort:z.number(),
  envVariables:z.array(EnvVariableSchema).optional(),
});

export type InferenceJobInput = z.infer<typeof InferenceJobInputSchema>;

export const submitInferJob =
procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/infer",
      tags: ["infer"],
      summary: "Submit A Inference Job",
    },
  })
  .input(InferenceJobInputSchema)
  .output(z.object({
    jobId: z.number(),
  }))
  .use(async ({ input:{ clusterId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createAiInferenceJob,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
      { clusterId, jobId:(res.data as any).jobId } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
      { clusterId } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(
    async ({ input, ctx: { user } }) => {
      const { clusterId, InferenceJobName , image, models } = input;

      const { ids:modelIds, isPrivates:isModelPrivates } = getIdPrivate(models);

      if (InferenceJobName.length > 42) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The length of InferenceJobName should not exceed 42",
        });
      }
      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const em = await forkEntityManager();
      const {
        modelVersions,
        image: existImage,
      } = await checkCreateAppEntity({
        em,
        datasets:undefined,
        algorithms:undefined,
        image,
        models:modelIds,
      });

      // 检查数据集、算法、模型和镜像是否有权限使用
      checkEntityAuth({
        algorithmVersions:[], datasetVersions:[], modelVersions, image:existImage, userId,
      });

      const jobId = await driver.withJobDriver({
        clusterId,
        user:userId,
      }, async (jobDriver) => {
        return await jobDriver.submitInferJob(input,{
          isModelPrivates,
          modelVersions,
          existImage,
        });
      },
      logger);

      return { jobId };
    },
  );

export const getSubmitInferenceParams =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/infer/{jobId}/submissionParameters",
      tags: ["jobs"],
      summary: "Get Submit Infer Job Parameters",
    },
  })
  .input(z.object({
    clusterId: z.string(),
    jobId: z.number(),
    sessionId: z.string(),
  }))
  .output(InferenceJobInputSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, jobId, sessionId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    return await driver.withJobDriver({
      clusterId,
      user:userId,
    }, async (jobDriver) => {
      return await jobDriver.getInferParams(sessionId,jobId);
    },
    logger);
  });
