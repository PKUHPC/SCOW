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
  sftpLstat,
  sftpReadFile,
  sftpWriteFile,
} from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import { join } from "path";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { callLog } from "src/server/setup/operationLog";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, checkEntityAuth, fetchJobInputParams, genPublicOrPrivateDataJsonString,
  validateUniquePaths } from "src/server/utils/app";
import { checkClusterAvailable, getAdapterClient } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { getIdPrivate } from "src/utils/app";
import { isParentOrSameFolder } from "src/utils/file";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { getCurrentClusters } from "../../../utils/clusters";

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
  jobName: string;
  jobId: number;
  appId?: string;
  submitTime: string;
  image: Image;
  jobType: JobType
}

export const IdPrivateSchema = z.object({
  id: z.number(),
  isPrivate: z.boolean(),
});

export type IdPrivate = z.infer<typeof IdPrivateSchema>;

const TrainJobInputSchema = z.object({
  clusterId: z.string(),
  trainJobName: z.string(),
  algorithms: z.array(IdPrivateSchema),
  image: z.number().optional(),
  isImagePrivate: z.boolean().optional(),
  remoteImageUrl: z.string().optional(),
  framework: Framework.optional(),
  datasets: z.array(IdPrivateSchema),
  models: z.array(IdPrivateSchema),
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
  // TensorFlow特有参数
  psNodes: z.number().optional(),
  workerNodes: z.number().optional(),
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
      const { clusterId, trainJobName ,algorithms, image, framework,
        remoteImageUrl, datasets,models, mountPoints = [], account, partition, coreCount,
        nodeCount, gpuCount, memory, maxTime, command, gpuType, psNodes, workerNodes } = input;

      const { ids:algorithmIds, isPrivates:isAlgorithmPrivates } = getIdPrivate(algorithms);
      const { ids:modelIds, isPrivates:isModelPrivates } = getIdPrivate(models);
      const { ids:datasetIds, isPrivates:isDatasetPrivates } = getIdPrivate(datasets);

      if (trainJobName.length > 42) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The length of trainJobName should not exceed 42",
        });
      }

      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const host = getClusterLoginNode(clusterId);
      if (!host) {
        throw clusterNotFound(clusterId);
      }

      const client = getAdapterClient(clusterId);

      const em = await forkEntityManager();
      const {
        datasetVersions,
        algorithmVersions,
        modelVersions,
        image: existImage,
      } = await checkCreateAppEntity({
        em,
        datasets:datasetIds,
        algorithms:algorithmIds,
        image,
        models:modelIds,
      });

      // 检查数据集、算法、模型和镜像是否有权限使用
      checkEntityAuth({
        datasetVersions, algorithmVersions,modelVersions, image:existImage, userId,
      });

      return await sshConnect(host, userId, logger, async (ssh) => {

        const homeDir = await getUserHomedir(ssh, userId, logger);
        const sftp = await ssh.requestSFTP();

        mountPoints.forEach((mountPoint) => {
          if (mountPoint && !isParentOrSameFolder(homeDir, mountPoint)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "mountPoint should be in homeDir",
            });
          }
        });

        const scowWorkDirectoryName = `${clusterId}-job-${dayjs().format("YYYYMMDD-HHmmss")}`;
        const trainJobsDirectory = join(aiConfig.appJobsDir, scowWorkDirectoryName);

        // 确保所有映射到容器的路径都不重复
        validateUniquePaths([
          trainJobsDirectory,
          ...isAlgorithmPrivates.map((isAlgorithmPrivate,idx) =>
            isAlgorithmPrivate ? algorithmVersions[idx].privatePath : algorithmVersions[idx].path)
          ,
          ...isDatasetPrivates.map((isDatasetPrivate,idx) =>
            isDatasetPrivate ? datasetVersions[idx].privatePath : datasetVersions[idx].path)
          ,
          ...isModelPrivates.map((isModelPrivate,idx) =>
            isModelPrivate ? modelVersions[idx].privatePath : modelVersions[idx].path)
          ,
          ...mountPoints,
        ]);

        // 检查挂载点是否为目录，不能是软链接
        for (const path of mountPoints) {
          const lstat = await sftpLstat(sftp)(path).catch((e) => {
            logger.error(e, "lstat %s as %s failed", path, userId);
            throw new TRPCError({ code: "FORBIDDEN", message: `${path} is not accessible` });
          });

          if (lstat.isSymbolicLink()) {
            throw new TRPCError({ code: "FORBIDDEN", message: `${path} is a symbolic link, not a directory` });
          }
        }

        // make sure trainJobsDirectory exists.
        await ssh.mkdir(trainJobsDirectory);
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
          // 第十个参数为多挂载点地址，以逗号分隔 (此挂载点是只读的)
          extraOptions: [
            JobType.TRAIN,
            "",
            remoteImageUrl || existImage?.path || "",
            JSON.stringify(
              algorithmVersions.map((algorithmVersion,idx) => isAlgorithmPrivates[idx]
                ? genPublicOrPrivateDataJsonString(algorithmVersion.privatePath,false)
                : genPublicOrPrivateDataJsonString(algorithmVersion.path,true),
              ))
            ,
            JSON.stringify(
              datasetVersions.map((datasetVersion,idx) => isDatasetPrivates[idx]
                ? genPublicOrPrivateDataJsonString(datasetVersion.privatePath,false)
                : genPublicOrPrivateDataJsonString(datasetVersion.path,true),
              ))
            ,
            JSON.stringify(
              modelVersions.map((modelVersion,idx) => isModelPrivates[idx]
                ? genPublicOrPrivateDataJsonString(modelVersion.privatePath,false)
                : genPublicOrPrivateDataJsonString(modelVersion.path,true),
              ))
            ,
            mountPoints.join(","),
            gpuType || "",
            // 如果是单机训练,则训练框架为空，表明为普通训练，华为的卡单机训练也要传框架
            // 如果nodeCount不为1但同时选定镜像又没有框架标签，该接口会报错
            (nodeCount === 1 && !gpuType?.startsWith("huawei.com")) ? "" : framework || "",
            aiConfig.publicMountPoints ? aiConfig.publicMountPoints.join(",") : "",
          ],
          psNodeCount:psNodes,
          workerNodeCount:workerNodes,
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
          jobName:trainJobName,
          sessionId: scowWorkDirectoryName,
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
    sessionId: z.string(),
  }))
  .output(TrainJobInputSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, jobId, sessionId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const host = getClusterLoginNode(clusterId);
    if (!host) throw new TRPCError({ code: "NOT_FOUND", message: `Cluster ${clusterId} not found.` });

    return await sshConnect(host, userId, logger, async (ssh) => {

      const homeDir = await getUserHomedir(ssh, userId, logger);
      const jobsDirectory = join(aiConfig.appJobsDir, sessionId);

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

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    const client = getAdapterClient(cluster);
    await asyncClientCall(client.job, "cancelJob", {
      userId,
      jobId,
    });
  });


const EventSchema = z.object({
  objName: z.string().optional(),
  objNamespace: z.string().optional(),
  objKind: z.string(),
  type: z.string(),
  message: z.string(),
  reason: z.string(),
  reportingComponent: z.string(),
  count: z.number().optional(),
});

export const getJobSchedulingAndStartupLogs =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/jobs/jobLogs/{jobId}",
      tags: ["jobs"],
      summary: "Get Job Scheduling And Startup Logs",
    },
  })
  .input(z.object({
    cluster: z.string(),
    jobId: z.number(),
  }))
  .output(z.object({
    jobEvent:z.array(EventSchema) ,
    podEvent:z.array(z.array(EventSchema)),
  }))
  .mutation(async ({ input, ctx: { user } }) => {

    const { cluster, jobId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    const client = getAdapterClient(cluster);
    const { job } = await asyncClientCall(client.job, "getJobById", {
      fields: ["pods","events"],
      jobId: jobId,
    });

    return {
      jobEvent:job?.events ?? [],
      podEvent:job?.pods.map((i) => i.events) ?? [],
    };
  });

export const getPodsByJobId =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/jobs/pods/{jobId}",
      tags: ["jobs"],
      summary: "Get Job Pods",
    },
  })
  .input(z.object({
    cluster: z.string(),
    jobId: z.number(),
  }))
  .output(z.object({
    pods:z.array(z.object({ podId:z.string(),podName:z.string() })),
  }))
  .mutation(async ({ input, ctx: { user } }) => {

    const { cluster, jobId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    const client = getAdapterClient(cluster);
    const { job } = await asyncClientCall(client.job, "getJobById", {
      fields: ["pod_info"],
      jobId: jobId,
    });

    return {
      pods:job?.pods.map((i) => ({ podId:i.podId,podName:i.podName })) ?? [],
    };
  });

export const getPodLogs = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/jobs/podLogs/{podId}",
      tags: ["pods"],
      summary: "Stream Pod Logs via Server-Sent Events",
      contentTypes: ["text/event-stream"],
    },
  })
  .input(z.object({
    cluster: z.string(),
    podId: z.string(),
  }))
  .output(z.void()) // 输出无法直接描述流式，使用 void
  .query(async ({ input, ctx }) => {
    const { cluster, podId } = input;
    const userId = ctx.user.identityId;
    const res = ctx.res; // 从上下文中获取底层响应对象

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    const client = getAdapterClient(cluster);

    // 设置 SSE 头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      // 调用 gRPC 流式方法
      const logStream = client.job.getPodLogs({ userId,podId });

      // 将 gRPC 流的数据写入响应
      for await (const message of logStream) {
        res.write(`data: ${JSON.stringify({ log: message.log })}\n\n`);
      }
    } catch (error: any) {
      res.status(500).write(`event: error\ndata: ${error.message}\n\n`);
    } finally {
      res.end();
    }

    return; // 返回 void，实际数据通过流发送
  });

export const downloadPodLog = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/jobs/podLogs/download/{podId}",
      tags: ["pods"],
      summary: "Download all pod logs so far",
    },
  })
  .input(z.object({
    cluster: z.string(),
    podId: z.string(),
  }))
  .output(z.void())
  .query(async ({ input: { cluster, podId }, ctx: { user, res } }) => {
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);

    const client = getAdapterClient(cluster);

    const filename = `${podId}_log.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");

    try {
      logger.info("Starting to get log stream...");
      const logStream = client.job.getPodLogs({ userId, podId });

      // 监听流的数据
      for await (const message of logStream) {
        // 获取到第一个日志时中断流
        if (message.log) {
          logger.info("Get the first log");
          res.write(message.log + "\n");

          // 终止流，只读取第一个日志
          logStream.destroy();
        }
      }

      res.end();
      return;
    } catch (error: any) {
      logger.error("An error occurred while downloading the log:",error.message);
      res.end();
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to download logs,${error.message}`,
      });
    }
  });

const dataPointSchema = z.object({
  timestampMillisecond: z.number().int(), // 这里是毫秒级 UNIX 时间戳
  value: z.number(),
});

const timeSeriesDataSchema = z.object({
  metrics: z.record(z.string(), z.string()),
  values: z.array(dataPointSchema),
});

export const getPodMonitorInfo =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/jobs/podMonitor/{podName}",
      tags: ["jobs"],
      summary: "Get Pod MonitorInfo",
    },
  })
  .input(z.object({
    cluster: z.string(),
    podName: z.string(),
    step:z.number().optional(), // 采样间隔，单位秒
    startTime:z.string(),
    endTime:z.string(),
  }))
  .output(z.object({
    monitorData:z.array(timeSeriesDataSchema),
  }))
  .mutation(async ({ input, ctx: { user } }) => {

    const { podName,step,startTime,endTime,cluster } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, cluster);
    const client = getAdapterClient(cluster);

    try {
      const { monitorData } = await asyncClientCall(client.job, "getPodMonitorInfo", {
        podName,
        stepSeconds:step ?? 15,
        start:startTime,
        end:endTime,
      });

      return { monitorData };
    } catch (error: any) {
      logger.error("get pod monitor info error",error.message);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to get pod monitor info,${error.message}`,
      });
    }
  });
