import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import type { ServerResponse } from "http";
import { aiConfig } from "src/server/config/ai";
import { config } from "src/server/config/env";
import { callLog } from "src/server/setup/operationLog";
import { driver } from "src/server/trpc/Driver";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, checkEntityAuth } from "src/server/utils/app";
import { checkClusterAvailable, getAdapterClient, getCurrentClusters } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { validateSubmitAiJobInfoUnderMis } from "src/server/utils/validation";
import { getIdPrivate } from "src/utils/app";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

interface ServerResponseWithFlush extends ServerResponse {
  flush: () => void;
}

interface ServerResponseWithFlush extends ServerResponse {
  flush: () => void;
}

// 分布式训练框架
export const Framework = z.union([
  z.literal("tensorflow"),
  z.literal("pytorch"),
  z.literal("mindspore"),
  z.literal("mpi"),
]);

export type FrameworkType = z.infer<typeof Framework>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
});

export type Image = z.infer<typeof ImageSchema>;

export const IdPrivateSchema = z.object({
  id: z.number(),
  isPrivate: z.boolean(),
  // 提交时对应的名称
  // 在展示作业详情时使用
  currentNameVersion: z.string().optional(),
});

export type IdPrivate = z.infer<typeof IdPrivateSchema>;

export const EnvVariableSchema = z.object({
  key: z.string(),
  value: z.string(),
});
export type EnvVariable = z.infer<typeof EnvVariableSchema>;

export const TrainJobInputSchema = z.object({
  clusterId: z.string(),
  trainJobName: z.string(),
  algorithms: z.array(IdPrivateSchema).optional(),
  image: z.number().optional(),
  isImagePrivate: z.boolean().optional(),
  // 提交时选择的本地镜像的名称,用于详情展示
  localImageName: z.string().optional(),
  remoteImageUrl: z.string().optional(),
  framework: Framework.optional(),
  datasets: z.array(IdPrivateSchema).optional(),
  models: z.array(IdPrivateSchema).optional(),
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
  // TensorFlow特有参数
  psNodes: z.number().optional(),
  workerNodes: z.number().optional(),
  envVariables:z.array(EnvVariableSchema).optional(),
  tensorBoardDataPath:z.string().optional(),
});

export type TrainJobInput = z.infer<typeof TrainJobInputSchema>;

export const MAX_JOB_NAME_LENGTH = 43;

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
      const { clusterId, trainJobName, algorithms, image, datasets, models, maxTime, account, partition } = input;

      const { ids:algorithmIds, isPrivates:isAlgorithmPrivates } = getIdPrivate(algorithms);
      const { ids:modelIds, isPrivates:isModelPrivates } = getIdPrivate(models);
      const { ids:datasetIds, isPrivates:isDatasetPrivates } = getIdPrivate(datasets);

      if (trainJobName.length > MAX_JOB_NAME_LENGTH) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The length of trainJobName should not exceed ${MAX_JOB_NAME_LENGTH}`,
        });
      }

      if (aiConfig.maxJobRunningTimeHours) {
        if (maxTime > (aiConfig.maxJobRunningTimeHours * 60)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `The job running time cannot exceed ${aiConfig.maxJobRunningTimeHours}` +
            ` hour${aiConfig.maxJobRunningTimeHours > 1 ? "s" : ""}`,
          });
        }
        if (maxTime === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The job running time cannot be 0",
          });
        }
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

      const jobId = await driver.withJobDriver({
        clusterId,
        user:userId,
      }, async (jobDriver) => {
        return await jobDriver.submitTrainJob(input, {
          isAlgorithmPrivates,
          isDatasetPrivates,
          isModelPrivates,
          algorithmVersions,
          datasetVersions,
          modelVersions,
          existImage,
        });
      },
      logger);

      return { jobId };
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

    return await driver.withJobDriver({
      clusterId,
      user:userId,
    }, async (jobDriver) => {
      return await jobDriver.getTrainParams(sessionId, jobId);
    },
    logger);
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


export const EventSchema = z.object({
  objName: z.string().optional(),
  objNamespace: z.string().optional(),
  objKind: z.string(),
  type: z.string(),
  message: z.string(),
  reason: z.string(),
  reportingComponent: z.string(),
  count: z.number().optional(),
  time:z.string().optional(),
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
    jobEvent:z.array(EventSchema),
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
      fields: ["pods"],
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
    rowLimit:z.number().optional(),
  }))
  .output(z.void()) // 输出无法直接描述流式，使用 void
  .query(async ({ input, ctx }) => {
    const { cluster, podId, rowLimit } = input;
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
      const logStream = client.job.getPodLogs({ userId,podId, rowLimit });

      res.on("close", () => {
        logStream.cancel();
        logger.info("SSE client disconnected");
      });

      // 将 gRPC 流的数据写入响应
      for await (const message of logStream) {
        res.write(`data: ${JSON.stringify({ log: message.log })}\n\n`);
        (res as unknown as ServerResponseWithFlush).flush?.(); // 必须 flush 输出，否则前端不会收到
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
