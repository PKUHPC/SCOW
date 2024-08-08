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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import {
  getUserHomedir,
  sftpExists,
  sftpReadFile,
  sftpWriteFile,
} from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, fetchJobInputParams, validateUniquePaths } from "src/server/utils/app";
import { getAdapterClient } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { isParentOrSameFolder } from "src/utils/file";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

const SESSION_METADATA_NAME = "session.json";



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

interface SessionMetadata {
  sessionId: string;
  jobId: number;
  appId?: string;
  submitTime: string;
  image: Image;
  jobType: JobType
}

const TrainJobInputSchema = z.object({
  clusterId: z.string(),
  trainJobName: z.string(),
  isAlgorithmPrivate: z.boolean().optional(),
  algorithm: z.number().optional(),
  image: z.number().optional(),
  remoteImageUrl: z.string().optional(),
  framework: Framework.optional(),
  isDatasetPrivate: z.boolean().optional(),
  dataset: z.number().optional(),
  isModelPrivate: z.boolean().optional(),
  model: z.number().optional(),
  mountPoints: z.array(z.string()).optional(),
  account: z.string(),
  partition: z.string().optional(),
  coreCount: z.number(),
  nodeCount: z.number(),
  gpuCount: z.number().optional(),
  memory: z.number().optional(),
  maxTime: z.number(),
  command: z.string(),
  gpuType: z.string().optional(),
});

export type TrainJobInput = z.infer<typeof TrainJobInputSchema>;

export const trainJob =
procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/jobs",
      tags: ["jobs"],
      summary: "Submit A Train Job",
    },
  })
  .input(TrainJobInputSchema)
  .output(z.object({
    jobId: z.number(),
  }))
  .use(async ({ input:{ clusterId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createAiTrain,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { clusterId, jobId:(res.data as any).newDatasetId } },
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
      const { clusterId, trainJobName, isAlgorithmPrivate, algorithm, image, framework, remoteImageUrl,
        isDatasetPrivate, dataset, isModelPrivate, model, mountPoints = [], account, partition,
        coreCount, nodeCount, gpuCount, memory, maxTime, command, gpuType } = input;
      const userId = user.identityId;

      const host = getClusterLoginNode(clusterId);
      if (!host) {
        throw clusterNotFound(clusterId);
      }

      const client = getAdapterClient(clusterId);

      // 检查是否存在同名的作业
      const existingJobName = await asyncClientCall(client.job, "getJobs", {
        fields: ["job_id"],
        filter: {
          users: [userId], accounts: [],states: [],jobName:trainJobName,
        },
      }).then((resp) => resp.jobs);

      if (existingJobName.length) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `trainJobName ${trainJobName} is already existed`,
        });
      }

      const em = await forkEntityManager();
      const {
        datasetVersion,
        algorithmVersion,
        modelVersion,
        image: existImage,
      } = await checkCreateAppEntity({
        em,
        dataset,
        algorithm,
        image,
        model,
      });

      return await sshConnect(host, userId, logger, async (ssh) => {

        const homeDir = await getUserHomedir(ssh, userId, logger);


        mountPoints.forEach((mountPoint) => {
          if (mountPoint && !isParentOrSameFolder(homeDir, mountPoint)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "mountPoint should be in homeDir",
            });
          }
        });

        const trainJobsDirectory = join(aiConfig.appJobsDir, trainJobName);

        // 确保所有映射到容器的路径都不重复
        validateUniquePaths([
          trainJobsDirectory,
          isAlgorithmPrivate ? algorithmVersion?.privatePath : algorithmVersion?.path,
          isDatasetPrivate ? datasetVersion?.privatePath : datasetVersion?.path,
          isModelPrivate ? modelVersion?.privatePath : modelVersion?.path,
          ...mountPoints,
        ]);

        // make sure trainJobsDirectory exists.
        await ssh.mkdir(trainJobsDirectory);
        const sftp = await ssh.requestSFTP();
        const remoteEntryPath = join(homeDir, trainJobsDirectory, "entry.sh");

        const entryScript = command;
        await sftpWriteFile(sftp)(remoteEntryPath, entryScript);

        const reply = await asyncClientCall(client.job, "submitJob", {
          userId,
          jobName: trainJobName,
          account,
          partition: partition!,
          coreCount,
          nodeCount,
          gpuCount: gpuCount ?? 0,
          memoryMb: Number(memory),
          timeLimitMinutes: maxTime,
          workingDirectory: trainJobsDirectory,
          script: remoteEntryPath,
          // 对于AI模块，需要传递的额外参数
          // 第一个参数确定是创建应用or训练任务，
          // 第二个参数为创建应用时的appId
          // 第三个参数为镜像地址
          // 第四个参数为算法版本地址
          // 第五个参数为数据集版本地址
          // 第六个参数为模型版本地址
          // 第七个参数为多挂载点地址，以逗号分隔
          // 第八个参数为gpuType, 表示训练时硬件卡的类型，由getClusterConfig接口获取
          // 第九个参数告知适配器 该镜像对应的AI训练框架 如 tensorflow, pytorch 等
          extraOptions: [
            JobType.TRAIN,
            "",
            remoteImageUrl || existImage?.path || "",
            algorithmVersion
              ? isAlgorithmPrivate
                ? algorithmVersion.privatePath
                : algorithmVersion.path
              : "",
            datasetVersion
              ? isDatasetPrivate
                ? datasetVersion.privatePath
                : datasetVersion.path
              : "",
            modelVersion
              ? isModelPrivate
                ? modelVersion.privatePath
                : modelVersion.path
              : "",
            mountPoints.join(","),
            gpuType || "",
            // 如果是单机训练,则训练框架为空，表明为普通训练，华为的卡单机训练也要传框架
            // 如果nodeCount不为1但同时选定镜像又没有框架标签，该接口会报错
            (nodeCount === 1 && !gpuType?.startsWith("huawei.com")) ? "" : framework || "",
          ],
        }).catch((e) => {
          const ex = e as ServiceError;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Submit train job failed, ${ex.details}`,
          });
        });

        // Save session metadata
        const metadata: SessionMetadata = {
          jobId: reply.jobId,
          sessionId: trainJobName,
          submitTime: new Date().toISOString(),
          image: {
            name: remoteImageUrl || existImage!.name,
            tag: existImage?.tag || "latest",
          },
          jobType: JobType.TRAIN,
        };
        await sftpWriteFile(sftp)(join(trainJobsDirectory, SESSION_METADATA_NAME), JSON.stringify(metadata));

        // 保存提交参数
        await sftpWriteFile(sftp)(join(trainJobsDirectory, `${reply.jobId}-input.json`), JSON.stringify(input));

        return { jobId: reply.jobId };
      });
    },
  );

export const getSubmitTrainParams =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/jobs/{jobId}/submissionParameters",
      tags: ["jobs"],
      summary: "Get Submit Train Job Parameters",
    },
  })
  .input(z.object({
    clusterId: z.string(),
    jobId: z.number(),
    jobName: z.string(),
  }))
  .output(TrainJobInputSchema)
  .query(async ({ input, ctx: { user } }) => {


    const { clusterId, jobId, jobName } = input;
    const userId = user.identityId;
    const host = getClusterLoginNode(clusterId);
    if (!host) throw new TRPCError({ code: "NOT_FOUND", message: `Cluster ${clusterId} not found.` });

    return await sshConnect(host, userId, logger, async (ssh) => {

      const homeDir = await getUserHomedir(ssh, userId, logger);
      const jobsDirectory = join(aiConfig.appJobsDir, jobName);

      const sftp = await ssh.requestSFTP();

      // 读取作业信息
      const metadataPath = join(jobsDirectory, SESSION_METADATA_NAME);

      if (!await sftpExists(sftp, metadataPath)) {
        return {} as TrainJobInput;
      }

      const content = await sftpReadFile(sftp)(metadataPath);
      const sessionMetadata = JSON.parse(content.toString()) as SessionMetadata;

      if (sessionMetadata.jobType !== JobType.TRAIN) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Job type of job ${jobId} is not Train`,
        });
      }

      const inputParamsPath = join(homeDir, jobsDirectory, `${jobId}-input.json`);

      return await fetchJobInputParams<TrainJobInput>(
        inputParamsPath, sftp, TrainJobInputSchema, logger,
      );
    });
  });

export const cancelJob =
procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/jobs/{jobId}",
      tags: ["jobs"],
      summary: "Cancel Train Job or App Session",
    },
  })
  .input(z.object({
    cluster: z.string(),
    jobId: z.number(),
  }))
  .output(z.void())
  .use(async ({ input:{ cluster,jobId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.cancelAiTrainOrApp,

    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { clusterId:cluster,jobId } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { clusterId:cluster,jobId } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {

    const { cluster, jobId } = input;

    const userId = user.identityId;
    const client = getAdapterClient(cluster);
    await asyncClientCall(client.job, "cancelJob", {
      userId,
      jobId,
    });
  });
