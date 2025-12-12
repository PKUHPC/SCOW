import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { jobInfo_PodStatusToJSON } from "@scow/ai-scheduler-adapter-protos/build/protos/job";
import { AppType } from "@scow/config/build/appForAi";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { libGetUserAvailableClusterApps } from "@scow/lib-server";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import fs from "fs";
import { join } from "path";
import { AppName } from "src/models/App";
import { ImageType } from "src/models/Image";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { clusters } from "src/server/config/clusters";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { Image as ImageEntity, Source, Status } from "src/server/entities/Image";
import { callLog } from "src/server/setup/operationLog";
import { driver } from "src/server/trpc/Driver";
import { procedure } from "src/server/trpc/procedure/base";
import { allApps, checkAppExist, checkCreateAppEntity,
  checkEntityAuth, formatJobDetailsExtraInputs, getAllTags, getClusterAppConfigs } from "src/server/utils/app";
import { checkClusterAvailable, getAdapterClient } from "src/server/utils/clusters";
import { getCurrentClusters } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { getProtoAppType } from "src/server/utils/getProtoAppType";
import { getProtoJobTypes } from "src/server/utils/getProtoJobType";
import {
  createHarborImageUrl,
  formatContainerId,
} from "src/server/utils/image";
import { isPortReachableThroughUrl } from "src/server/utils/isPortReachable";
import { logger } from "src/server/utils/logger";
import { paginate, paginationSchema } from "src/server/utils/pagination";
import { getAppConnectionInfoFromAdapterForAi } from "src/server/utils/schedulerAdapterUtils";
import { getClusterLoginNode } from "src/server/utils/ssh";
import { validateSubmitAiJobInfoUnderMis } from "src/server/utils/validation";
import { getIdPrivate } from "src/utils/app";
import { formatTime } from "src/utils/datetime";
import { parseIp } from "src/utils/parse";
import { BASE_PATH } from "src/utils/processEnv";
import { z } from "zod";

import { PartitionSchema } from "../config";
import { booleanQueryParam } from "../utils";
import { EnvVariableSchema, EventSchema, IdPrivateSchema, MAX_JOB_NAME_LENGTH } from "./jobs";

const ImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
});

export type Image = z.infer<typeof ImageSchema>;

const JobTypeSchema = z.nativeEnum(JobType);

const AppSessionSchema = z.object({
  sessionId: z.string(),
  jobName: z.string(),
  jobId: z.number(),
  submitTime: z.string(),
  jobType: JobTypeSchema,
  image: ImageSchema,
  appId: z.string().optional(),
  appName: z.string().optional(),
  state: z.string(),
  dataPath: z.string(),
  runningTime: z.string(),
  timeLimit: z.string(),
  reason: z.string().optional(),
  partition:z.string(),
  gpusAlloc:z.number(),
  cpusAlloc:z.number(),
  memAlloc:z.number(),
  nodesAlloc:z.number(),
  gpusReq:z.number(),
  cpusReq:z.number(),
  memReq:z.number(),
  nodesReq:z.number(),
});

export type AppSession = z.infer<typeof AppSessionSchema>;

export interface SessionMetadata {
  sessionId: string;
  jobName: string;
  jobId: number;
  appId?: string;
  submitTime: string;
  image: Image;
  jobType: JobType;
}

export const SERVER_ENTRY_COMMAND = fs.readFileSync("assets/app/server_entry.sh", { encoding: "utf-8" });
export const VNC_ENTRY_COMMAND = fs.readFileSync("assets/app/vnc_entry.sh", { encoding: "utf-8" });
export const TENSORBOARD_ENTRY_COMMAND = fs.readFileSync("assets/app/tensorboard_entry.sh", { encoding: "utf-8" });

export const SESSION_METADATA_NAME = "session.json";

// 适配器将该文件写在了/tmp目录下
export const SERVER_SESSION_INFO = "/tmp/server_session_info.json";

export const appSchema = z.object({ id: z.string(), name: z.string(), logoPath: z.string().optional() });

export type AppSchema = z.infer<typeof appSchema>;

export interface ClusterAppsResultSchema {
  clusterId: string;
  apps: AppSchema[];
};

const I18nStringSchema = z.union([
  z.string(),
  z.object({
    i18n: z.object({
      default: z.string(),
      en: z.string().optional(),
      zh_cn: z.string().optional(),
    }),
  }),
]);

const SelectOptionSchema = z.object({
  value: z.string(),
  label: I18nStringSchema,
  requireGpu: z.boolean().optional(),
});

const AppCustomAttributeSchema = z.object({
  type: z.union([
    z.literal("NUMBER"),
    z.literal("SELECT"),
    z.literal("TEXT"),
  ]),
  label: I18nStringSchema,
  name: z.string(),
  required: z.boolean(),
  placeholder: I18nStringSchema.optional(),
  defaultValue: z.union([
    z.string(),
    z.number(),
  ]).optional(),
  select: z.array(SelectOptionSchema),
});

export type AppCustomAttribute = z.infer<typeof AppCustomAttributeSchema>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AttributeTypeSchema = z.enum(["TEXT", "NUMBER", "SELECT"]);

export type AttributeType = z.infer<typeof AttributeTypeSchema>;

const ClusterConfig = z.object({
  schedulerName: z.string(),
  clusterId: z.string(),
  partitions: z.array(PartitionSchema),
});

export const listAvailableApps = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/apps",
      tags: ["app"],
      summary: "List all Available Apps",
    },
  })
  .input(z.object({ clusterIds: z.array(z.string()) }))
  .output(z.array(z.object({
    clusterId: z.string(),
    apps: z.array(appSchema),
  })))
  .query(async ({ input, ctx: { user } }) => {
    const { clusterIds } = input;

    // 获取用户可访问的所有集群
    const currentClusterIds = await getCurrentClusters(user.identityId);
    const validClusterIds: string[] = [];
    // 验证所有请求的集群是否可用
    clusterIds.forEach((clusterId) => {
      try {
        checkClusterAvailable(currentClusterIds, clusterId);
        validClusterIds.push(clusterId);
      } catch (error) {
        logger.error(
          `failed to get cluster ${clusterId}'s available apps: `,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    });

    const results = await Promise.allSettled(validClusterIds.map(async (clusterId) => {
      // 如果开启了管理系统的授权应用功能
      if (config.MIS_DEPLOYED && commonConfig.allowAppAuthorization && user.identityId) {
        const availableApps = await libGetUserAvailableClusterApps(
          logger,
          clusterId,
          user.identityId,
          config.MIS_SERVER_URL,
          commonConfig.scowApi?.auth?.token,
        );

        return { ...availableApps, clusterId };
      }

      const appsConfig = getClusterAppConfigs(clusterId);

      return {
        apps: Object.keys(appsConfig).map((appId) => ({
          id: appId,
          name: appsConfig[appId].name,
          logoPath: appsConfig[appId].logoPath || undefined,
        })),
        clusterId,
      };
    }));

    // 只返回成功获取到的集群应用信息
    const successfulResults: ClusterAppsResultSchema[] = [];
    for (const [index, result] of results.entries()) {
      const clusterId = validClusterIds[index];

      if (result.status === "fulfilled") {
        successfulResults.push(result.value);
      } else {
        const reason = result.reason;
        const errorMessage = reason instanceof Error ? reason.message : String(reason);
        logger.error(`failed to get cluster ${clusterId}'s available apps: ${errorMessage}`);
      }
    }

    return successfulResults;
  });

export const getAppMetadata = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/apps/{appId}",
      tags: ["app"],
      summary: "Get App Metadata",
    },
  })
  .input(z.object({ clusterId: z.string(), appId: z.string() }))
  .output(z.object({
    appName: z.string(),
    appImage: z.object({
      name: z.string(),
      tag: z.string(),
    }).optional(),
    attributes: z.array(AppCustomAttributeSchema),
    appComment: I18nStringSchema.optional(),
    appStartCommand:z.string(),
  }))
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, appId } = input;

    const currentClusterIds = await getCurrentClusters(user.identityId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const apps = getClusterAppConfigs(clusterId);
    const app = checkAppExist(apps, appId);

    const attributes: AppCustomAttribute[] = [];

    if (app.attributes) {
      app.attributes.forEach((item) => {
        const attributeType = item.type.toUpperCase() as AttributeType;
        attributes.push({
          type: attributeType,
          label: item.label,
          name: item.name,
          required: item.required,
          defaultValue: item.defaultValue,
          placeholder: item.placeholder,
          select: item.select?.map((x) => {
            return {
              value: x.value,
              label:x.label,
              requireGpu: x.requireGpu,
            };
          }) ?? [],
        });
      });
    }

    const comment = app.appComment ?? "";
    const startCommand = app.web?.startCommand ?? app.vnc?.xstartup ?? "";

    return {
      appName: app.name,
      appImage: app.image,
      attributes,
      appComment: comment,
      appStartCommand:startCommand,
    };
  });

export const CreateAppInputSchema = z.object({
  clusterId: z.string(),
  appId: z.string(),
  appName: z.string(),
  appJobName: z.string(),
  algorithms: z.array(IdPrivateSchema),
  isImagePrivate: z.boolean().optional(),
  image: z.number().optional(),
  // 提交时选择的本地镜像的名称,用于详情展示
  localImageName: z.string().optional(),
  remoteImageUrl: z.string().optional(),
  startCommand: z.string().optional(),
  datasets: z.array(IdPrivateSchema),
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
  // APP工作目录
  workingDirectory: z.string().optional(),
  customAttributes: z.record(z.string(), z.union([z.number(), z.string(), z.undefined()])),
  gpuType: z.string().optional(),
  envVariables:z.array(EnvVariableSchema).optional(),
});

export type CreateAppInput = z.infer<typeof CreateAppInputSchema>;

export const createAppSession = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions",
      tags: ["appSessions"],
      summary: "Create APP Session",
    },
  })
  .input(CreateAppInputSchema)
  .output(z.object({
    jobId: z.number(),
  }))
  .use(async ({ input:{ clusterId, appName }, ctx, next }) => {
    const res = await next({ ctx });
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createApp,
    };

    if (res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { clusterId, jobId:(res.data as any).jobId, accountName:"", appName } },
      OperationResult.SUCCESS);
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload:
        { clusterId, accountName:"", appName } },
      OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const { clusterId, appId, appJobName,
      maxTime, algorithms,image, datasets, models, customAttributes, account, partition } = input;

    const { ids:algorithmIds, isPrivates:isAlgorithmPrivates } = getIdPrivate(algorithms);
    const { ids:modelIds, isPrivates:isModelPrivates } = getIdPrivate(models);
    const { ids:datasetIds, isPrivates:isDatasetPrivates } = getIdPrivate(datasets);

    if (appJobName.length > MAX_JOB_NAME_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `The length of appJobName should not exceed ${MAX_JOB_NAME_LENGTH}`,
      });
    }

    if (aiConfig.maxJobRunningTimeHours) {
      if (maxTime > (aiConfig.maxJobRunningTimeHours * 60)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The app running time cannot exceed ${aiConfig.maxJobRunningTimeHours}` +
          ` hour${aiConfig.maxJobRunningTimeHours > 1 ? "s" : ""}`,
        });
      }
      if (maxTime === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The app running time cannot be 0",
        });
      }
    }

    const userId = user.identityId;
    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const apps = getClusterAppConfigs(clusterId);
    const app = checkAppExist(apps, appId);

    // 管理系统存在时，增加用户账户封锁状态，授权应用，授权集群分区等鉴权
    if (config.MIS_DEPLOYED) {
      await validateSubmitAiJobInfoUnderMis({
        userId,
        accountName: account,
        clusterId,
        logger,
        partitionName: partition,
        checkAccountApp: true,
        appId,
      });
    }

    const proxyBasePath = join(BASE_PATH, "/api/proxy", clusterId);

    const attributesConfig = app.attributes;
    attributesConfig?.forEach((attribute) => {
      if (attribute.required && !(attribute.name in customAttributes)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `custom form attribute ${attribute.name} is required but not found`,
        });
      }

      switch (attribute.type) {
        case "number":
          if (customAttributes[attribute.name] && Number.isNaN(Number(customAttributes[attribute.name]))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `custom form attribute ${
                attribute.name} should be of type number, but of type ${typeof customAttributes[attribute.name]}`,
            });
          }
          break;

        case "text":
          break;

        case "select":
        // check the option selected by user is in select attributes as the config defined
          if (customAttributes[attribute.name]
          && !(attribute.select!.some((optionItem) => optionItem.value === customAttributes[attribute.name]))) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `
              the option value of ${attribute.name} selected by user should be
              one of select attributes as the ${appId} config defined,
              but is ${customAttributes[attribute.name]}`,
            });
          }
          break;

        default:
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `the custom form attributes type in ${appId} config should be one of number, text or select,
          but the type of ${attribute.name} is ${attribute.type as string}`,
          });
      }
    });

    const em = await forkEntityManager();

    const {
      image: existImage,
      datasetVersions,
      algorithmVersions,
      modelVersions,
    } = await checkCreateAppEntity({
      em,
      image,
      datasets:datasetIds,
      algorithms:algorithmIds,
      models:modelIds,
    });

    // 检查数据集、算法、模型和镜像是否有权限使用
    checkEntityAuth({
      datasetVersions, algorithmVersions, modelVersions, image:existImage, userId,
    });

    const jobId = await driver.withJobDriver({
      clusterId,
      user:userId,
    }, async (jobDriver) => {
      return await jobDriver.createApp(input, {
        isAlgorithmPrivates,
        isDatasetPrivates,
        isModelPrivates,
        algorithmVersions,
        datasetVersions,
        modelVersions,
        app,
        proxyBasePath,
        existImage,
      });
    },
    logger);

    return { jobId };
  });

export const getCreateAppParams =
  procedure
    .meta({
      openapi: {
        method: "GET",
        path: "/appSessions/{jobId}/submissionParameters",
        tags: ["appSessions"],
        summary: "Get Create App Session Parameters",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
    }))
    .output(CreateAppInputSchema)
    .query(async ({ input, ctx: { user } }) => {

      const { clusterId, jobId, sessionId } = input;
      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      return await driver.withJobDriver({
        clusterId,
        user:userId,
      }, async (jobDriver) => {
        return await jobDriver.getAppParams(sessionId, jobId);
      },
      logger);
    });

export const saveImage =
  procedure
    .meta({
      openapi: {
        method: "POST",
        path: "/appSessions/{jobId}/saveImage",
        tags: ["appSessions"],
        summary: "Save Image From App Session",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      jobId: z.number(),
      imageName: z.string(),
      imageTag: z.string(),
      imageDesc: z.string().optional(),
      imageTypes:z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
      imageInferServicePort:z.string().optional(),
      imageStartCommand:z.string().optional(),
    }))
    .output(z.object({ imageId:z.number() }))
    .mutation(
      async ({ input, ctx: { user, req } }) => {
        const userId = user.identityId;
        const { clusterId, jobId, imageName, imageTag, imageDesc,imageTypes,
          imageInferServicePort,imageStartCommand } = input;

        // tag的唯一标识符
        const tagPostfix = dayjs().unix().toString();

        // 检查镜像在数据库中是否重复
        const em = await forkEntityManager();
        const existImage = await em.findOne(ImageEntity, { owner: userId, name: imageName, tag: imageTag });
        if (existImage) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Image with name: ${imageName} and tag: ${imageTag} of user: ${userId} already exists.`,
          });
        }

        const currentClusterIds = await getCurrentClusters(userId);
        checkClusterAvailable(currentClusterIds, clusterId);
        // 根据jobId获取该应用运行在集群的节点和对应的containerId
        const client = getAdapterClient(clusterId);

        const { job } = await asyncClientCall(client.job, "getJobById", {
          fields: ["pods"],
          jobId,
        });

        if (!job) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Can not find this running job",
          });
        }

        // 暂时先用第一个pod
        const nodeName = job.pods[0].nodeName;
        const containerId = job.pods[0].containerId;

        if (!nodeName || !containerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can not find node or containerId of this running job",
          });
        }

        const formattedContainerId = formatContainerId(clusterId, containerId);

        const harborImageUrl = await createHarborImageUrl(imageName, imageTag + tagPostfix, user.identityId,logger);
        const localImageUrl = `${userId}/${imageName}:${imageTag + tagPostfix}`;

        // 数据库添加image
        const newImage = new ImageEntity({
          name: imageName,
          tag: imageTag,
          tagPostfix,
          description: imageDesc,
          path: harborImageUrl,
          owner: userId,
          source: Source.EXTERNAL,
          status: Status.CREATING,
          sourcePath: harborImageUrl,
          types:imageTypes,
          inferServicePort:imageInferServicePort,
          startCommand:imageStartCommand,
          clusterId,
        });
        await em.persistAndFlush(newImage);

        const createProcess = async () => {
          const em = await forkEntityManager();
          const image = await em.findOne(ImageEntity, { name: imageName, tag: imageTag, owner:userId });

          if (!image) {
            throw new Error(`copyImage error: image ${imageName}:${imageTag} not found`);
          }

          const logInfo = {
            operatorUserId: user.identityId,
            operatorIp: parseIp(req) ?? "",
            operationTypeName: OperationType.saveImage,
          };

          try {
            await driver.withImageDriver({
              clusterId,
              user:user.identityId,
            },async (imageDriver) => {
              await imageDriver.saveImage({
                node:nodeName,
                formattedContainerId,
                localImageUrl,
                harborImageUrl,
              });
            },
            logger);

            // 更新数据库
            image.status = Status.CREATED;
            await em.persistAndFlush(image);

            await callLog({ ...logInfo, operationTypePayload:
              { jobId, imageName,tag:imageTag } },
            OperationResult.SUCCESS);

            return;
          } catch (error: any) {
            image.failedReason = error.message;
            image.status = Status.FAILURE;
            await em.persistAndFlush(image);

            await callLog({ ...logInfo, operationTypePayload:
              { jobId, imageName, tag:imageTag } },
            OperationResult.FAIL);

            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Save image failed, ${error.message}`,
            });
          }
        };

        // 不 await 直接返回
        createProcess();

        return { imageId:newImage.id };
      },
    );

export const listAppSessions =
  procedure
    .meta({
      openapi: {
        method: "POST",
        path: "/appSessions/list",
        tags: ["appSessions"],
        summary: "List APP Sessions",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      isRunning: booleanQueryParam().optional(),
      jobTypes: z.array(z.nativeEnum(JobType)).optional(),
      ...paginationSchema.shape,
    }))
    .output(z.object({ sessions: z.array(AppSessionSchema), count: z.number() }))
    .query(async ({ input, ctx: { user } }) => {

      const { clusterId, isRunning, jobTypes, page, pageSize } = input;

      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const host = getClusterLoginNode(clusterId);

      if (!host) {
        throw clusterNotFound(clusterId);
      }

      const filteredSessions = await driver.withJobDriver({
        clusterId,
        user:userId,
      }, async (jobDriver) => {
        const protoJobTypes = getProtoJobTypes(jobTypes ?? []);
        return await jobDriver.getAiJobs(clusterId, isRunning, protoJobTypes);
      }, logger);

      const { paginatedItems: paginatedSessions, totalCount } = paginate(
        filteredSessions, page, pageSize,
      );

      return { sessions: paginatedSessions, count: totalCount };
    });

const podInfoSchema = z.object({
  podId: z.string(),
  podName: z.string(),
  namespace: z.string(),
  nodeName:z.string(),
  podIp: z.string(),
  podStatus: z.string(),
  events: z.array(EventSchema),
  podCreatedTime: z.string().optional(),
  podEndTime: z.string().optional(),
  podReason: z.string().optional(),
});

const ExtraDisplayInputsSchema = z.object({
  isDefaultImage: z.boolean().optional(),
  imageNameOrUrl: z.string().optional(),
  datasetNames: z.array(z.string().optional()).optional(),
  algorithmNames: z.array(z.string().optional()).optional(),
  modelNames: z.array(z.string().optional()).optional(),
  mountPoints: z.array(z.string()).optional(),
  envVariables:z.array(EnvVariableSchema).optional(),
  startCommand: z.string().optional(),
}).optional();
export type ExtraDisplayInputs = z.infer<typeof ExtraDisplayInputsSchema>;

const SingleAppSessionSchema = z.object({
  jobName: z.string(),
  jobId: z.number(),
  runningTime: z.string(),
  submitTime: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  timeLimit: z.string(),
  state: z.string(),
  reason: z.string().optional(),
  qos:z.string(),
  partition:z.string(),
  account:z.string(),
  cpusReq:z.number(),
  cpusAlloc:z.number().optional(),
  gpusReq:z.number(),
  gpusAlloc:z.number().optional(),
  memReq:z.number(),
  memAlloc:z.number().optional(),
  nodesReq:z.number(),
  nodesAlloc:z.number().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  jobEvent:z.array(EventSchema),
  podInfo:z.array(podInfoSchema),
  tensorBoardInfo:z.object({
    node:z.string(),
    port:z.number(),
  }).optional(),
  extraDisplayInputs: ExtraDisplayInputsSchema,
  uniqueJobName:z.string(),
});

export const getJobDetails =
  procedure
    .meta({
      openapi: {
        method: "GET",
        path: "/appSession",
        tags: ["appSessions"],
        summary: "Get Job Details",
      },
    })
    .input(z.object({
      clusterId: z.string(),
      jobId:z.number(),
      sessionId:z.string(),
      jobType:z.string(),
      appId:z.string().optional(),
    }))
    .output(SingleAppSessionSchema)
    .query(async ({ input, ctx: { user } }) => {

      const { clusterId, jobId, jobType, appId, sessionId } = input;

      const userId = user.identityId;

      const currentClusterIds = await getCurrentClusters(userId);
      checkClusterAvailable(currentClusterIds, clusterId);

      const clusterHost = getClusterLoginNode(clusterId);

      if (!clusterHost) {
        throw clusterNotFound(clusterId);
      }

      const apps = getClusterAppConfigs(clusterId);

      const client = getAdapterClient(clusterId);
      const { job } = await asyncClientCall(client.job, "getJobById", {
        fields: [
          "job_id", "name","state", "partition","elapsed_seconds","time_limit_minutes",
          "reason","qos","cpus_req","cpus_alloc","mem_req_mb","mem_alloc_mb","gpus_req","gpus_alloc",
          "nodes_req","nodes_alloc","submit_time","start_time","end_time","partition","account",
          "pods","events","tensor_board_info","unique_job_name",
        ],
        jobId,
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Can not find this running job(jobId:${jobId})`,
        });
      }

      let host: string | undefined = undefined;
      let port: number | undefined = undefined;

      // 初始定义需要额外展示的参数
      let extraDisplayResult: ExtraDisplayInputs = {
        imageNameOrUrl: undefined,
        isDefaultImage: undefined,
        datasetNames: undefined,
        algorithmNames: undefined,
        modelNames: undefined,
        startCommand: undefined,
        envVariables: undefined,
      };

      if (jobType === JobType.APP) {
        const app = appId ? apps[appId] : undefined;
        if (!app) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `app id ${appId} is not found`,
          });
        }

        // judge whether the app is ready
        if (job.state === "RUNNING") {
          try {
            const client = getAdapterClient(clusterId);
            const connectionInfo =
                await getAppConnectionInfoFromAdapterForAi(client, jobId, logger);
            if (connectionInfo?.response?.$case === "appConnectionInfo") {
              host = connectionInfo.response.appConnectionInfo.host;
              port = connectionInfo.response.appConnectionInfo.port;
            }
          } catch (error: any) {
            logger.info("Job(jobId:%s) gets app connection info failed , reason: %o",
              jobId, error.message);
          }
        }

        // 获取APP作业提交参数
        const appJobParams = await driver.withJobDriver({
          clusterId,
          user:userId,
        }, async (jobDriver) => {
          return await jobDriver.getAppParams(sessionId, jobId);
        },
        logger);

        extraDisplayResult = formatJobDetailsExtraInputs(appJobParams, extraDisplayResult);
      }
      // 推理需要端口
      else if (jobType === JobType.INFER) {
        if (job.state === "RUNNING") {
          const client = getAdapterClient(clusterId);
          const connectionInfo = await getAppConnectionInfoFromAdapterForAi(client, jobId, logger);
          if (connectionInfo?.response?.$case === "appConnectionInfo") {
            host = clusters[clusterId].inferConfig?.proxyHost ?? aiConfig.inferConfig?.proxyHost;
            port = connectionInfo.response.appConnectionInfo.port;
          }
        }

        // 获取推理作业提交参数
        const inferJobParams = await driver.withJobDriver({
          clusterId,
          user:userId,
        }, async (jobDriver) => {
          return await jobDriver.getInferParams(sessionId, jobId);
        },
        logger);

        extraDisplayResult = formatJobDetailsExtraInputs(inferJobParams, extraDisplayResult);
      }
      else {
        // 获取训练作业提交参数
        const trainJobParams = await driver.withJobDriver({
          clusterId,
          user:userId,
        }, async (jobDriver) => {
          return await jobDriver.getTrainParams(sessionId, jobId);
        },
        logger);

        extraDisplayResult = formatJobDetailsExtraInputs(trainJobParams, extraDisplayResult);
      }

      const podInfo = job.pods.map((pod) => ({ ...pod,podStatus: jobInfo_PodStatusToJSON(pod.podStatus) }));

      return {
        ...job,
        jobId,
        jobName:job.name,
        runningTime: job.elapsedSeconds !== undefined
          ? formatTime(job.elapsedSeconds * 1000) : "",
        timeLimit:job.timeLimitMinutes ? formatTime(job.timeLimitMinutes * 60 * 1000) : "",
        memReq:job.memReqMb,
        memAlloc:job.memAllocMb,
        host,
        port,
        jobEvent:job.events,
        podInfo,
        extraDisplayInputs: extraDisplayResult,
      };
    });


const TIMEOUT_MS = 3000;

export const checkAppConnectivity =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions/{jobId}/checkConnectivity",
      tags: ["appSessions"],
      summary: "Check APP Session Connectivity",
    },
  })
  .input(z.object({
    clusterId: z.string(),
    jobId: z.number(),
    sessionId: z.string(),
  })).output(z.object({
    ok: z.boolean(),
  })).query(
    async ({ input, ctx: { req, user } }) => {

      const { jobId, clusterId, sessionId } = input;

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);

      try {
        const client = getAdapterClient(clusterId);

        const connectionInfo = await getAppConnectionInfoFromAdapterForAi(client, jobId, logger);

        if (connectionInfo?.response?.$case === "appConnectionInfo") {
          const host = connectionInfo.response.appConnectionInfo.host;
          const port = connectionInfo.response.appConnectionInfo.port;

          const apps = getClusterAppConfigs(clusterId);

          const reply = await driver.withJobDriver({
            clusterId, user: user.identityId,
          }, async (jobDriver) => {
            return await jobDriver.connectToApp(clusterId, sessionId);
          }, logger);

          const app = apps[reply.appId];

          if (!app) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: `app id ${reply.appId} is not found`,
            });
          }

          const reachable = await isPortReachableThroughUrl(
            req, TIMEOUT_MS, clusterId, host, port, app.type, app.web?.proxyType);
          return { ok: reachable };
        } else {
          return { ok: false };
        }
      } catch {
        return { ok: false };
      }
    },

  );

export const checkDevHostAppConnectivity =
procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions/{jobId}/checkDevHostConnectivity",
      tags: ["appSessions"],
      summary: "Check Dev Host APP Session Connectivity",
    },
  })
  .input(z.object({
    clusterId: z.string(),
    jobId: z.number(),
    sessionId: z.string(),
    appName: z.nativeEnum(AppName),
  })).output(z.object({
    ok: z.boolean(),
  })).query(
    async ({ input, ctx: { req, user } }) => {
      const { jobId, clusterId, sessionId, appName } = input;

      if (!clusters[clusterId]?.ai.devHost) {
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "dev host is not implemented",
        });
      }

      const currentClusterIds = await getCurrentClusters(user.identityId);
      checkClusterAvailable(currentClusterIds, clusterId);
      const protoAppType = getProtoAppType(appName);

      try {
        const client = getAdapterClient(clusterId);

        const connectionInfo = await getAppConnectionInfoFromAdapterForAi(client, jobId, logger, protoAppType);

        if (connectionInfo?.response?.$case === "appConnectionInfo") {
          const host = connectionInfo.response.appConnectionInfo.host;
          const port = connectionInfo.response.appConnectionInfo.port;

          const reply = await driver.withJobDriver({
            clusterId, user: user.identityId,
          }, async (jobDriver) => {
            return await jobDriver.connectToApp(clusterId, sessionId, protoAppType);
          }, logger);

          let proxyType: "relative" | "absolute";
          switch (appName) {
            case AppName.VSCODE:
              proxyType = "relative";
              break;
            case AppName.JUPYTER_LAB:
              proxyType = "absolute";
              break;
            default:
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Unknown app name ${appName as string} of app id ${reply.appId}`,
              });
          }

          const reachable = await isPortReachableThroughUrl(
            req, TIMEOUT_MS, clusterId, host, port, "web", proxyType);

          return { ok: reachable };
        } else {
          return { ok: false };
        }
      } catch {
        return { ok: false };
      }
    },

  );

const AppConnectPropsSchema = z.object({
  method: z.string(),
  path: z.string(),
  query: z.record(z.string(), z.string()).optional(),
  formData: z.record(z.string(), z.string()).optional(),
});

const ConnectToAppResponseSchema = z.intersection(
  z.object({
    host: z.string(),
    port: z.number(),
    password: z.string(),
  }),
  z.union([
    z.object({
      type: z.literal("web"),
      connect: AppConnectPropsSchema,
      proxyType: z.union([
        z.literal("relative"),
        z.literal("absolute"),
      ]),
      customFormData: z.record(z.string(), z.string()).optional(),
    }),
    z.object({ type: z.literal("vnc") }),
  ]),
);

export const connectToApp =
procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions/{sessionId}/connect",
      tags: ["appSessions"],
      summary: "Connect to APP Session",
    },
  })
  .input(z.object({
    cluster: z.string(),
    sessionId: z.string(),
  }))
  .output(ConnectToAppResponseSchema)
  .mutation(async ({ input, ctx: { user } }) => {

    const { cluster, sessionId } = input;
    const userId = user.identityId;

    const host = getClusterLoginNode(cluster);
    if (!host) {
      throw clusterNotFound(cluster);
    }

    const apps = getClusterAppConfigs(cluster);

    const reply = await driver.withJobDriver({
      clusterId:cluster,
      user:userId,
    }, async (jobDriver) => {
      return await jobDriver.connectToApp(cluster, sessionId);
    }, logger);

    const app = apps[reply.appId];

    if (!app) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `app id ${reply.appId} is not found`,
      });
    }

    switch (app.type) {
      case AppType.vnc:
        return {
          host: reply.host,
          port: reply.port,
          password: reply.password,
          type: "vnc",
          vnc: {},
        };
      case AppType.web:
        return {
          host: reply.host,
          port: reply.port,
          password: reply.password,
          type: "web",
          connect : {
            method:app.web!.connect.method,
            query: app.web!.connect.query ?? {},
            formData: app.web!.connect.formData ?? {},
            path: app.web!.connect.path,
          },
          proxyType: app.web!.proxyType === "absolute"
            ? "absolute"
            : "relative",
        };
      default:
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Unknown app type ${app.type as string} of app id ${reply.appId}`,
        });
    }

  });

export const connectToDevHostApp =
procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions/{sessionId}/connectDevHostApp",
      tags: ["appSessions"],
      summary: "Connect to Dev Host APP Session",
    },
  })
  .input(z.object({
    cluster: z.string(),
    sessionId: z.string(),
    appName: z.nativeEnum(AppName),
  }))
  .output(ConnectToAppResponseSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { cluster, sessionId, appName } = input;

    if (!clusters[cluster]?.ai.devHost) {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message: "dev host is not implemented",
      });
    }

    const userId = user.identityId;

    const host = getClusterLoginNode(cluster);
    if (!host) {
      throw clusterNotFound(cluster);
    }

    const reply = await driver.withJobDriver({
      clusterId:cluster,
      user:userId,
    }, async (jobDriver) => {
      const protoAppType = getProtoAppType(appName);
      return await jobDriver.connectToApp(cluster, sessionId, protoAppType);
    }, logger);

    return {
      host: reply.host,
      port: reply.port,
      password: reply.password,
      type: "web",
      connect : {
        method: "POST",
        formData: {
          password: "{{ PASSWORD }}",
        },
        path: "/login",
      },
      proxyType: appName === AppName.JUPYTER_LAB
        ? "absolute"
        : "relative",
    };
  });


export const listApps = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/apps/search",
      tags: ["app"],
      summary: "List all Apps By tags",
    },
  })
  .input(z.object({
    tags: z.string().optional(),
  }))
  .output((z.object({ apps: z.array(appSchema) })))
  .query(async ({ input }) => {

    const { tags } = input;

    const apps = Object.entries(allApps)?.filter(([_, config]) => {
      if (tags) {
        return tags.split(",")
          .some((tag) =>
            (config.tags?.includes(tag) || config.clusterSpecificConfigs?.some((x) => x.config.tags?.includes(tag))),
          );
      }
      return true;
    }).map(([id, config]) => {

      const aggregateTags = config.clusterSpecificConfigs?.reduce((prev, curr) => {
        curr.config.tags?.forEach((tag) => {
          if (!prev.has(tag)) {
            prev.add(tag);
          }
        });
        return prev;
      }, new Set(config.tags)) || config.tags || [];

      return ({
        id,
        name: config.name,
        logoPath: config.logoPath,
        tags: Array.from(aggregateTags),
        appComment: getI18nConfigCurrentText(config.appComment, undefined),
      });
    });

    return {
      apps,
    };
  });

export const listTags = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/apps/tags/search",
      tags: ["app"],
      summary: "List all App tags",
    },
  })
  .input(z.void())
  .output(z.object({ tags: z.array(z.string()) }))
  .query(async () => {

    const tags = getAllTags(allApps);

    return {
      tags,
    };
  });

export const listClusters = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/apps/clusters/search",
      tags: ["app"],
      summary: "List All Clusters By AppID",
    },
  })
  .input(z.object({
    appId: z.string(),
  }))
  .output(z.object({ clusterConfigs: z.array(ClusterConfig) }))
  .query(async ({ input, ctx: { user } }) => {
    const { appId } = input;
    const allClusterIds = await getCurrentClusters(user.identityId);
    const clusterIds: string[] = [];
    // 获取集群ids
    // common app
    if (!allApps[appId].clusterSpecificConfigs) {
      clusterIds.push(...allClusterIds);
    } else {
      allApps[appId].clusterSpecificConfigs?.map((config) => {
        clusterIds.push(config.cluster);
      });
    }

    const configs = await Promise.all(clusterIds
      .map(async (clusterId) => {
        const client = getAdapterClient(clusterId);
        if (!client) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message:`cluster ${clusterId} is not found`,
          });
        }
        return await asyncClientCall(client.config, "getClusterConfig", {});
      }));

    return {
      clusterConfigs: configs.map((config,idx) => ({ ...config,clusterId:clusterIds[idx] })),
    };

  });
