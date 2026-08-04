import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AppType } from "@scow/config/build/appForAi";
import { getCommonConfig } from "@scow/config/src/common";
import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { AppScope, libGetAccounts, libGetUserAvailableApps, libGetUserAvailableClusterApps } from "@scow/lib-server";
import { libWebGetAppForbiddenAccounts } from "@scow/lib-web/build/server/appAuthorization";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { getI18nTypeFormat } from "@scow/lib-web/build/utils/typeConversion";
import { AccountStatusFilter as AccountStatusFilterProtos } from "@scow/protos/build/portal/job";
import { GetUserAvailableClusterAppsResponse_App } from "@scow/protos/build/server/app_authorization";
import { jobInfo_PodStatusToJSON } from "@scow/scheduler-adapter-protos/build/job";
import { TRPCError } from "@trpc/server";
import dayjs from "dayjs";
import fs from "fs";
import { join } from "path";
import { AppName } from "src/models/App";
import { ImageType } from "src/models/Image";
import { JobType } from "src/models/Job";
import { AccountStatusFilter } from "src/models/Resource";
import { aiConfig } from "src/server/config/ai";
import { clusters } from "src/server/config/clusters";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";
import { AiJobSubmitRecord } from "src/server/entities/AiJobSubmitRecord";
import { Image as ImageEntity, Source, Status } from "src/server/entities/Image";
import { callLog } from "src/server/setup/operationLog";
import { driver } from "src/server/trpc/Driver";
import { procedure } from "src/server/trpc/procedure/base";
import {
  allApps,
  checkAppExist,
  checkCreateAppEntity,
  checkEntityAuth,
  formatJobDetailsExtraInputs,
  getAllTags,
  getClusterAppConfigs,
  hasNonUtf8Segment,
  validateRemoteImageUrl,
} from "src/server/utils/app";
import { checkClusterAvailable, getAdapterClient } from "src/server/utils/clusters";
import { getCurrentClusters } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { getProtoAppType } from "src/server/utils/getProtoAppType";
import { allProtoAiJobTypes, getProtoJobTypes } from "src/server/utils/getProtoJobType";
import { createHarborImageUrl } from "src/server/utils/image";
import { isPortReachableThroughUrl } from "src/server/utils/isPortReachable";
import { logger } from "src/server/utils/logger";
import { AIJobLabelType, validateMaxRunningTimeMinutes } from "src/server/utils/maxRunningTime";
import { paginate, paginationSchema } from "src/server/utils/pagination";
import { getUserAssignedResourceDetails } from "src/server/utils/resource";
import { getAppConnectionInfoFromAdapterForAi } from "src/server/utils/schedulerAdapterUtils";
import { fetchSubmitRecord } from "src/server/utils/submitRecord";
import { validateSubmitAiJobInfoUnderMis } from "src/server/utils/validation";
import { getIdPrivate } from "src/utils/app";
import { formatTime } from "src/utils/datetime";
import { parseIp } from "src/utils/parse";
import { BASE_PATH } from "src/utils/processEnv";
import { z } from "zod";

import { CreateDevHostInputSchema } from "../devHost/devHost";
import { booleanQueryParam } from "../utils";
import { InferenceJobInputSchema } from "./infer";
import { EnvVariableSchema, EventSchema, IdPrivateSchema, MAX_JOB_NAME_LENGTH, TrainJobInputSchema } from "./jobs";

const ImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
});

export type Image = z.infer<typeof ImageSchema>;

const JobTypeSchema = z.enum(JobType);

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
  partition: z.string(),
  gpusAlloc: z.number(),
  cpusAlloc: z.number(),
  memAlloc: z.number(),
  nodesAlloc: z.number(),
  gpusReq: z.number(),
  cpusReq: z.number(),
  memReq: z.number(),
  nodesReq: z.number(),
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

export const SESSION_METADATA_NAME = "session.json";
export const TOTAL_SESSIONS = "total_sessions.json";

// 旧版应用连接信息文件默认路径。新提交的 app 会在 job driver 中注入持久化路径。
export const SERVER_SESSION_INFO = "/tmp/server_session_info.json";

export interface ClusterAppsResultSchema {
  clusterId: string;
  apps: AppSchema[];
}

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

export const appSchema = z.object({
  id: z.string(),
  name: z.string(),
  logoPath: z.string().optional(),
  comment: I18nStringSchema.optional(),
  image: z.string().optional(),
  startCommand: z.string().optional(),
});

export type AppSchema = z.infer<typeof appSchema>;

const mapAvailableAppFromMis = (app: GetUserAvailableClusterAppsResponse_App): AppSchema => ({
  ...app,
  comment: getI18nTypeFormat(app.comment),
});

const SelectOptionSchema = z.object({
  value: z.string(),
  label: I18nStringSchema,
  requireGpu: z.boolean().optional(),
});

const AppCustomAttributeSchema = z.object({
  type: z.union([z.literal("NUMBER"), z.literal("SELECT"), z.literal("TEXT"), z.literal("PASSWORD")]),
  label: I18nStringSchema,
  name: z.string(),
  required: z.boolean(),
  placeholder: I18nStringSchema.optional(),
  defaultValue: z.union([z.string(), z.number()]).optional(),
  select: z.array(SelectOptionSchema),
});

export type AppCustomAttribute = z.infer<typeof AppCustomAttributeSchema>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AttributeTypeSchema = z.enum(["TEXT", "NUMBER", "SELECT", "PASSWORD"]);

export type AttributeType = z.infer<typeof AttributeTypeSchema>;

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
  .output(
    z.array(
      z.object({
        clusterId: z.string(),
        apps: z.array(appSchema),
      }),
    ),
  )
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

    const results = await Promise.allSettled(
      validClusterIds.map(async (clusterId) => {
        // 如果开启了管理系统的授权应用功能
        if (config.MIS_DEPLOYED && commonConfig.allowAppAuthorization && user.identityId) {
          const availableApps = await libGetUserAvailableClusterApps(
            logger,
            clusterId,
            user.identityId,
            config.MIS_SERVER_URL,
            commonConfig.scowApi?.auth?.token,
            AppScope.AI,
          );

          return {
            clusterId,
            apps: availableApps.apps.map(mapAvailableAppFromMis),
          };
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
      }),
    );

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

// 获取所有集群中所有可用的App
export const listAllAvailableAppsFromAllClusters = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/allAvailableAppsFromAllClusters",
      tags: ["app"],
      summary: "List all available apps from all clusters",
    },
  })
  .input(z.void())
  .output(z.object({ apps: z.array(appSchema) }))
  .query(async ({ ctx: { user } }) => {
    const currentClusterIds = await getCurrentClusters(user.identityId);
    const aiClusterSet = new Set(Object.keys(clusters));
    const availableClusterIds = currentClusterIds.filter((clusterId) => aiClusterSet.has(clusterId));

    if (availableClusterIds.length === 0) {
      logger.info("User %s has no authorized clusters when listing all apps.", user.identityId);
      return { apps: [] };
    }

    // 如果开启了管理系统的授权应用功能，仅返回关联账户下可用的交互式应用
    if (config.MIS_DEPLOYED && commonConfig.allowAppAuthorization && user.identityId) {
      const { apps: availableApps } = await libGetUserAvailableApps(
        logger,
        availableClusterIds,
        user.identityId,
        config.MIS_SERVER_URL,
        commonConfig.scowApi?.auth?.token,
        AppScope.AI,
      );
      return {
        apps: availableApps.map(mapAvailableAppFromMis),
      };
    }

    const appMap = new Map<string, AppSchema>();
    availableClusterIds.forEach((clusterId) => {
      const clusterApps = getClusterAppConfigs(clusterId);
      Object.entries(clusterApps).forEach(([id, app]) => {
        if (!appMap.has(id)) {
          appMap.set(id, {
            id,
            name: app.name,
            logoPath: app.logoPath || undefined,
            comment: app.appComment,
            image: app.image ? `${app.image?.name}:${app.image?.tag}` : undefined,
            startCommand: app.web?.startCommand ?? app.vnc?.xstartup ?? "",
          });
        }
      });
    });

    return {
      apps: Array.from(appMap.values()),
    };
  });

// 应用可用账户下的可用集群
export const listAppAvailableAccountsAndClusters = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/apps/accountsAndClusters",
      tags: ["apps"],
      summary: "List app available accounts and clusters",
    },
  })
  .input(
    z.object({
      appId: z.optional(z.string()),
    }),
  )
  .output(z.object({ accountClusters: z.record(z.string(), z.array(z.string())) }))
  .query(async ({ input, ctx: { user } }) => {
    const commonConfig = getCommonConfig();
    const { appId } = input;
    const currentClusterIds = await getCurrentClusters(user.identityId);
    const currentAiClusterIds = currentClusterIds.filter((clusterId) => Boolean(clusters[clusterId]));

    if (currentAiClusterIds.length === 0) {
      return { accountClusters: {} };
    }

    const buildAccountClusters = async (
      clusterIds: string[],
      getClusterAccounts: (clusterId: string) => Promise<string[] | undefined>,
    ): Promise<Record<string, string[]>> => {
      const accountClusterMap = new Map<string, Set<string>>();

      for (const clusterId of clusterIds) {
        const clusterAccounts = await getClusterAccounts(clusterId);
        if (!clusterAccounts?.length) {
          continue;
        }

        let appForbiddenAccounts: string[] = [];
        if (config.MIS_DEPLOYED && config.MIS_SERVER_URL && commonConfig.allowAppAuthorization && appId) {
          appForbiddenAccounts = await libWebGetAppForbiddenAccounts(
            clusterId,
            appId,
            config.MIS_SERVER_URL,
            commonConfig.scowApi?.auth?.token,
            AppScope.AI,
          );
        }

        clusterAccounts
          .filter((account) => !appForbiddenAccounts.includes(account))
          .forEach((account) => {
            if (!accountClusterMap.has(account)) {
              accountClusterMap.set(account, new Set());
            }
            accountClusterMap.get(account)!.add(clusterId);
          });
      }

      return Object.fromEntries(
        Array.from(accountClusterMap.entries()).map(([account, clusters]) => [account, Array.from(clusters)]),
      ) as Record<string, string[]>;
    };

    if (!commonConfig.scowResource?.enabled) {
      let misAccounts: string[] | undefined;
      if (config.MIS_DEPLOYED && commonConfig.scowApi?.auth?.token) {
        const { accounts } = await libGetAccounts(
          logger,
          user.identityId,
          AccountStatusFilterProtos.UNBLOCKED_ONLY,
          config.MIS_SERVER_URL,
          commonConfig.scowApi.auth.token,
        );
        misAccounts = accounts;
      }

      const accountClusters = await buildAccountClusters(currentAiClusterIds, async (clusterId) => {
        if (misAccounts) {
          return misAccounts;
        }

        const client = getAdapterClient(clusterId);
        if (!client) {
          logger.warn(`Cluster ${clusterId} not found when listing app available accounts.`);
          return undefined;
        }

        const response = await asyncClientCall(client.account, "listAccounts", { userId: user.identityId });
        return response.accounts ?? [];
      });

      return { accountClusters };
    }

    const assignedResourceDetails =
      (await getUserAssignedResourceDetails(user.identityId, AccountStatusFilter.UNBLOCKED_ONLY)) ?? [];

    const currentClusterSet = new Set(currentAiClusterIds);
    const clusterAccountMap = new Map<string, Set<string>>();

    assignedResourceDetails.forEach(({ accountName, assignedClusterPartitions }) => {
      Object.entries(assignedClusterPartitions ?? {}).forEach(([clusterId, partitions]) => {
        if (!currentClusterSet.has(clusterId) || partitions.length === 0) {
          return;
        }

        if (!clusterAccountMap.has(clusterId)) {
          clusterAccountMap.set(clusterId, new Set());
        }
        clusterAccountMap.get(clusterId)!.add(accountName);
      });
    });

    const accountClusters = await buildAccountClusters(currentAiClusterIds, async (clusterId) => {
      return Array.from(clusterAccountMap.get(clusterId) ?? []);
    });

    return { accountClusters };
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
  .output(
    z.object({
      appName: z.string(),
      appImage: z
        .object({
          name: z.string(),
          tag: z.string(),
        })
        .optional(),
      attributes: z.array(AppCustomAttributeSchema),
      appComment: I18nStringSchema.optional(),
      appStartCommand: z.string(),
      appLogoPath: z.string().optional(),
    }),
  )
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
          select:
            item.select?.map((x) => {
              return {
                value: x.value,
                label: x.label,
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
      appStartCommand: startCommand,
      appLogoPath: app.logoPath,
    };
  });

export const CreateAppInputSchema = z.object({
  clusterId: z.string(),
  appId: z.string(),
  appName: z.string().optional(),
  appJobName: z.string(),
  algorithms: z.array(IdPrivateSchema).optional(),
  isImagePrivate: z.boolean().optional(),
  image: z.number().optional(),
  // 提交时选择的本地镜像的名称,用于详情展示
  localImageName: z.string().optional(),
  remoteImageUrl: z.string().optional(),
  startCommand: z.string().optional(),
  datasets: z.array(IdPrivateSchema).optional(),
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
  // APP工作目录
  workingDirectory: z.string().optional(),
  customAttributes: z.record(z.string(), z.union([z.number(), z.string(), z.undefined()])),
  gpuType: z.string().optional(),
  envVariables: z.array(EnvVariableSchema).optional(),
  privateImageRepositoryCredentials: z
    .object({
      userName: z.string(),
      password: z.string(),
    })
    .optional(),
});

export type CreateAppInput = z.infer<typeof CreateAppInputSchema>;

export const AppSubmitRecordFormDataSchema = CreateAppInputSchema.omit({
  clusterId: true,
  account: true,
  privateImageRepositoryCredentials: true,
});

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
  .output(
    z.object({
      jobId: z.number(),
    }),
  )
  .use(async ({ input: { clusterId, appName }, ctx, next }) => {
    const res = await next({ ctx });
    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createApp,
    };

    if (res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: {
            clusterId,
            jobId: (res.data as any).jobId,
            accountName: "",
            appName,
          },
        },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog(
        {
          ...logInfo,
          operationTypePayload: { clusterId, accountName: "", appName },
        },
        OperationResult.FAIL,
      );
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const {
      clusterId,
      appId,
      appJobName,
      maxTime,
      algorithms,
      image,
      datasets,
      models,
      customAttributes,
      account,
      partition,
      mountPoints,
      remoteImageUrl,
    } = input;

    const { ids: algorithmIds, isPrivates: isAlgorithmPrivates, targets: algorithmTargets } = getIdPrivate(algorithms);
    const { ids: modelIds, isPrivates: isModelPrivates, targets: modelTargets } = getIdPrivate(models);
    const { ids: datasetIds, isPrivates: isDatasetPrivates, targets: datasetTargets } = getIdPrivate(datasets);

    if (appJobName.length > MAX_JOB_NAME_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `The length of appJobName should not exceed ${MAX_JOB_NAME_LENGTH}`,
      });
    }

    validateMaxRunningTimeMinutes(maxTime, clusters[clusterId]?.ai.app?.maxRunningTimeHours, AIJobLabelType.app);
    validateRemoteImageUrl(remoteImageUrl);

    if (mountPoints?.some((mountPoint) => hasNonUtf8Segment(mountPoint.path))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Files or folders with non-UTF-8 names cannot be selected",
      });
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
                attribute.name
              } should be of type number, but of type ${typeof customAttributes[attribute.name]}`,
            });
          }
          break;

        case "text":
          break;

        case "password":
          break;

        case "select":
          // check the option selected by user is in select attributes as the config defined
          if (
            customAttributes[attribute.name] &&
            !attribute.select!.some((optionItem) => optionItem.value === customAttributes[attribute.name])
          ) {
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
            message: `the custom form attributes type in ${appId} config should be one of number, text, select or password,
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
      datasets: datasetIds,
      algorithms: algorithmIds,
      models: modelIds,
    });

    // 检查数据集、算法、模型和镜像是否有权限使用
    checkEntityAuth({
      datasetVersions,
      algorithmVersions,
      modelVersions,
      image: existImage,
      userId,
    });

    const algorithmVersionsWithTarget = algorithmVersions.map((v, i) => ({ ...v, target: algorithmTargets[i] ?? "" }));
    const datasetVersionsWithTarget = datasetVersions.map((v, i) => ({ ...v, target: datasetTargets[i] ?? "" }));
    const modelVersionsWithTarget = modelVersions.map((v, i) => ({ ...v, target: modelTargets[i] ?? "" }));

    const jobId = await driver.withJobDriver(
      {
        clusterId,
        user: userId,
      },
      async (jobDriver) => {
        return await jobDriver.createApp(input, {
          isAlgorithmPrivates,
          isDatasetPrivates,
          isModelPrivates,
          algorithmVersions: algorithmVersionsWithTarget,
          datasetVersions: datasetVersionsWithTarget,
          modelVersions: modelVersionsWithTarget,
          app,
          proxyBasePath,
          existImage,
        });
      },
      logger,
    );

    const { clusterId: _cid, account: _acc, privateImageRepositoryCredentials: _cred, ...rawFormData } = input;
    const parsedFormData = AppSubmitRecordFormDataSchema.safeParse(rawFormData);
    if (!parsedFormData.success) {
      logger.warn("Failed to parse app form data for jobId %s: %o", jobId, parsedFormData.error);
    } else {
      try {
        await em.persistAndFlush(
          new AiJobSubmitRecord({
            userId,
            jobType: JobType.APP,
            jobId,
            appId: input.appId,
            cluster: clusterId,
            account,
            formData: parsedFormData.data,
          }),
        );
      } catch (e) {
        logger.warn("Failed to save app job submit record for jobId %s: %o", jobId, e);
      }
    }

    return { jobId };
  });

export const getCreateAppParams = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions/{jobId}/submissionParameters",
      tags: ["appSessions"],
      summary: "Get Create App Session Parameters",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
    }),
  )
  .output(CreateAppInputSchema)
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
      CreateAppInputSchema,
      () => driver.withJobDriver({ clusterId, user: userId }, (d) => d.getAppParams(sessionId, jobId), logger),
      logger,
    );
  });

export const saveImage = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions/{jobId}/saveImage",
      tags: ["appSessions"],
      summary: "Save Image From App Session",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      imageName: z.string(),
      imageTag: z.string(),
      imageDesc: z.string().optional(),
      imageTypes: z.array(z.enum([ImageType.APP, ImageType.TRAIN, ImageType.INFER, ImageType.DEV_HOST])),
      imageInferServicePort: z.string().optional(),
      imageStartCommand: z.string().optional(),
    }),
  )
  .output(z.object({ imageId: z.number() }))
  .mutation(async ({ input, ctx: { user, req } }) => {
    const userId = user.identityId;
    const { clusterId, jobId, imageName, imageTag, imageDesc, imageTypes, imageInferServicePort, imageStartCommand } =
      input;

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

    const harborImageUrl = await createHarborImageUrl(imageName, imageTag + tagPostfix, user.identityId, logger);
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
      types: imageTypes,
      inferServicePort: imageInferServicePort,
      startCommand: imageStartCommand,
      clusterId,
    });
    await em.persistAndFlush(newImage);

    const createProcess = async () => {
      const em = await forkEntityManager();
      const image = await em.findOne(ImageEntity, { name: imageName, tag: imageTag, owner: userId });

      if (!image) {
        throw new Error(`copyImage error: image ${imageName}:${imageTag} not found`);
      }

      const logInfo = {
        operatorUserId: user.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.saveImage,
      };

      try {
        await driver.withImageDriver(
          {
            clusterId,
            user: user.identityId,
          },
          async (imageDriver) => {
            await imageDriver.saveImage({
              node: nodeName,
              rowContainerId: containerId,
              localImageUrl,
              harborImageUrl,
              imageId: image.id,
            });
          },
          logger,
        );

        // 更新数据库
        image.status = Status.CREATED;
        await em.persistAndFlush(image);

        await callLog(
          {
            ...logInfo,
            operationTypePayload: { jobId, imageName, tag: imageTag },
          },
          OperationResult.SUCCESS,
        );

        return;
      } catch (error: any) {
        image.failedReason = error.message;
        image.status = Status.FAILURE;
        await em.persistAndFlush(image);

        await callLog(
          {
            ...logInfo,
            operationTypePayload: { jobId, imageName, tag: imageTag },
          },
          OperationResult.FAIL,
        );

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Save image failed, ${error.message}`,
        });
      }
    };

    // 不 await 直接返回
    createProcess();

    return { imageId: newImage.id };
  });

export const listAppSessions = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions/list",
      tags: ["appSessions"],
      summary: "List APP Sessions",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      isRunning: booleanQueryParam().optional(),
      jobTypes: z.array(z.enum(JobType)).optional(),
      ...paginationSchema.shape,
    }),
  )
  .output(z.object({ sessions: z.array(AppSessionSchema), count: z.number() }))
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, isRunning, jobTypes, page, pageSize } = input;

    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const filteredSessions = await driver.withJobDriver(
      {
        clusterId,
        user: userId,
      },
      async (jobDriver) => {
        const protoJobTypes = jobTypes?.length ? getProtoJobTypes(jobTypes) : allProtoAiJobTypes;
        return await jobDriver.getAiJobs(clusterId, isRunning, protoJobTypes);
      },
      logger,
    );

    const { paginatedItems: paginatedSessions, totalCount } = paginate(filteredSessions, page, pageSize);

    return { sessions: paginatedSessions, count: totalCount };
  });

const podInfoSchema = z.object({
  podId: z.string(),
  podName: z.string(),
  namespace: z.string(),
  nodeName: z.string(),
  podIp: z.string(),
  podStatus: z.string(),
  events: z.array(EventSchema),
  podCreatedTime: z.string().optional(),
  podEndTime: z.string().optional(),
  podReason: z.string().optional(),
});

const ResourceMountSchema = z.object({
  name: z.string(),
  target: z.string(),
});

const ExtraDisplayInputsSchema = z
  .object({
    isDefaultImage: z.boolean().optional(),
    imageNameOrUrl: z.string().optional(),
    // 旧字段：仅保存名称字符串，保持向后兼容
    datasetNames: z.array(z.string().optional()).optional(),
    algorithmNames: z.array(z.string().optional()).optional(),
    modelNames: z.array(z.string().optional()).optional(),
    // 新字段：保存名称+挂载路径，用于详情页表格展示
    datasetMounts: z.array(ResourceMountSchema).optional(),
    algorithmMounts: z.array(ResourceMountSchema).optional(),
    modelMounts: z.array(ResourceMountSchema).optional(),
    mountPoints: z
      .array(
        z.object({
          path: z.string(),
          target: z.string(),
        }),
      )
      .optional(),
    envVariables: z.array(EnvVariableSchema).optional(),
    startCommand: z.string().optional(),
  })
  .optional();
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
  qos: z.string(),
  partition: z.string(),
  account: z.string(),
  cpusReq: z.number(),
  cpusAlloc: z.number().optional(),
  gpusReq: z.number(),
  gpusAlloc: z.number().optional(),
  memReq: z.number(),
  memAlloc: z.number().optional(),
  nodesReq: z.number(),
  nodesAlloc: z.number().optional(),
  host: z.string().optional(),
  port: z.number().optional(),
  jobEvent: z.array(EventSchema),
  podInfo: z.array(podInfoSchema),
  tensorBoardInfo: z
    .object({
      node: z.string(),
      port: z.number(),
    })
    .optional(),
  extraDisplayInputs: ExtraDisplayInputsSchema,
  uniqueJobName: z.string(),
});

export const getJobDetails = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSession",
      tags: ["appSessions"],
      summary: "Get Job Details",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
      jobType: z.string(),
      appId: z.string().optional(),
    }),
  )
  .output(SingleAppSessionSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, jobId, jobType, appId, sessionId } = input;

    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const apps = getClusterAppConfigs(clusterId);

    const em = await forkEntityManager();
    const client = getAdapterClient(clusterId);
    const { job } = await asyncClientCall(client.job, "getJobById", {
      fields: [
        "job_id",
        "name",
        "state",
        "partition",
        "elapsed_seconds",
        "time_limit_minutes",
        "reason",
        "qos",
        "cpus_req",
        "cpus_alloc",
        "mem_req_mb",
        "mem_alloc_mb",
        "gpus_req",
        "gpus_alloc",
        "nodes_req",
        "nodes_alloc",
        "submit_time",
        "start_time",
        "end_time",
        "partition",
        "account",
        "pods",
        "events",
        "tensor_board_info",
        "unique_job_name",
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
          const connectionInfo = await getAppConnectionInfoFromAdapterForAi(client, jobId, logger);
          if (connectionInfo?.response?.$case === "appConnectionInfo") {
            host = connectionInfo.response.appConnectionInfo.host;
            port = connectionInfo.response.appConnectionInfo.port;
          }
        } catch (error: any) {
          logger.info("Job(jobId:%s) gets app connection info failed , reason: %o", jobId, error.message);
        }
      }

      // 获取APP作业提交参数
      const appJobParams = await fetchSubmitRecord(
        em,
        userId,
        clusterId,
        jobId,
        CreateAppInputSchema,
        () => driver.withJobDriver({ clusterId, user: userId }, (d) => d.getAppParams(sessionId, jobId), logger),
        logger,
      );

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
      const inferJobParams = await fetchSubmitRecord(
        em,
        userId,
        clusterId,
        jobId,
        InferenceJobInputSchema,
        () => driver.withJobDriver({ clusterId, user: userId }, (d) => d.getInferParams(sessionId, jobId), logger),
        logger,
      );

      extraDisplayResult = formatJobDetailsExtraInputs(inferJobParams, extraDisplayResult);
    } else if (jobType === JobType.DEV_HOST) {
      // 获取开发机作业提交参数
      const devHostParams = await fetchSubmitRecord(
        em,
        userId,
        clusterId,
        jobId,
        CreateDevHostInputSchema,
        () => driver.withJobDriver({ clusterId, user: userId }, (d) => d.getDevHostParams(sessionId, jobId), logger),
        logger,
      );

      extraDisplayResult = formatJobDetailsExtraInputs(devHostParams, extraDisplayResult);
    } else {
      // 获取训练作业提交参数
      const trainJobParams = await fetchSubmitRecord(
        em,
        userId,
        clusterId,
        jobId,
        TrainJobInputSchema,
        () => driver.withJobDriver({ clusterId, user: userId }, (d) => d.getTrainParams(sessionId, jobId), logger),
        logger,
      );

      extraDisplayResult = formatJobDetailsExtraInputs(trainJobParams, extraDisplayResult);
    }

    const podInfo = job.pods.map((pod) => ({ ...pod, podStatus: jobInfo_PodStatusToJSON(pod.podStatus) }));

    return {
      ...job,
      jobId,
      jobName: job.name,
      runningTime: job.elapsedSeconds !== undefined ? formatTime(job.elapsedSeconds * 1000) : "",
      timeLimit: job.timeLimitMinutes ? formatTime(job.timeLimitMinutes * 60 * 1000) : "",
      memReq: job.memReqMb,
      memAlloc: job.memAllocMb,
      host,
      port,
      jobEvent: job.events,
      podInfo,
      extraDisplayInputs: extraDisplayResult,
    };
  });

const TIMEOUT_MS = 3000;

export const checkAppConnectivity = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions/{jobId}/checkConnectivity",
      tags: ["appSessions"],
      summary: "Check APP Session Connectivity",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
    }),
  )
  .output(
    z.object({
      ok: z.boolean(),
    }),
  )
  .query(async ({ input, ctx: { req, user } }) => {
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

        const reply = await driver.withJobDriver(
          {
            clusterId,
            user: user.identityId,
          },
          async (jobDriver) => {
            return await jobDriver.connectToApp(clusterId, sessionId);
          },
          logger,
        );

        const app = apps[reply.appId];

        if (!app) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `app id ${reply.appId} is not found`,
          });
        }

        const reachable = await isPortReachableThroughUrl(
          req,
          TIMEOUT_MS,
          clusterId,
          host,
          port,
          app.type,
          app.web?.proxyType,
        );
        return { ok: reachable };
      } else {
        return { ok: false };
      }
    } catch {
      return { ok: false };
    }
  });

export const checkDevHostAppConnectivity = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/appSessions/{jobId}/checkDevHostConnectivity",
      tags: ["appSessions"],
      summary: "Check Dev Host APP Session Connectivity",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
      appName: z.enum(AppName),
    }),
  )
  .output(
    z.object({
      ok: z.boolean(),
    }),
  )
  .query(async ({ input, ctx: { req, user } }) => {
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

        const reply = await driver.withJobDriver(
          {
            clusterId,
            user: user.identityId,
          },
          async (jobDriver) => {
            return await jobDriver.connectToApp(clusterId, sessionId, protoAppType);
          },
          logger,
        );

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

        const reachable = await isPortReachableThroughUrl(req, TIMEOUT_MS, clusterId, host, port, "web", proxyType);

        return { ok: reachable };
      } else {
        return { ok: false };
      }
    } catch {
      return { ok: false };
    }
  });

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
      proxyType: z.union([z.literal("relative"), z.literal("absolute")]),
      customFormData: z.record(z.string(), z.string()).optional(),
    }),
    z.object({ type: z.literal("vnc") }),
  ]),
);

export const connectToApp = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions/{sessionId}/connect",
      tags: ["appSessions"],
      summary: "Connect to APP Session",
    },
  })
  .input(
    z.object({
      cluster: z.string(),
      sessionId: z.string(),
    }),
  )
  .output(ConnectToAppResponseSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { cluster, sessionId } = input;
    const userId = user.identityId;

    const apps = getClusterAppConfigs(cluster);

    const reply = await driver.withJobDriver(
      {
        clusterId: cluster,
        user: userId,
      },
      async (jobDriver) => {
        return await jobDriver.connectToApp(cluster, sessionId);
      },
      logger,
    );

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
          connect: {
            method: app.web!.connect.method,
            query: app.web!.connect.query ?? {},
            formData: app.web!.connect.formData ?? {},
            path: app.web!.connect.path,
          },
          proxyType: app.web!.proxyType === "absolute" ? "absolute" : "relative",
        };
      default:
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Unknown app type ${app.type as string} of app id ${reply.appId}`,
        });
    }
  });

export const connectToDevHostApp = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/appSessions/{sessionId}/connectDevHostApp",
      tags: ["appSessions"],
      summary: "Connect to Dev Host APP Session",
    },
  })
  .input(
    z.object({
      cluster: z.string(),
      sessionId: z.string(),
      appName: z.enum(AppName),
    }),
  )
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

    const reply = await driver.withJobDriver(
      {
        clusterId: cluster,
        user: userId,
      },
      async (jobDriver) => {
        const protoAppType = getProtoAppType(appName);
        return await jobDriver.connectToApp(cluster, sessionId, protoAppType);
      },
      logger,
    );

    return {
      host: reply.host,
      port: reply.port,
      password: reply.password,
      type: "web",
      connect: {
        method: "POST",
        formData: {
          password: "{{ PASSWORD }}",
        },
        path: "/login",
      },
      proxyType: appName === AppName.JUPYTER_LAB ? "absolute" : "relative",
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
  .input(
    z.object({
      tags: z.string().optional(),
    }),
  )
  .output(z.object({ apps: z.array(appSchema) }))
  .query(async ({ input }) => {
    const { tags } = input;

    const apps = Object.entries(allApps)
      ?.filter(([_, config]) => {
        if (tags) {
          return tags
            .split(",")
            .some(
              (tag) =>
                config.tags?.includes(tag) || config.clusterSpecificConfigs?.some((x) => x.config.tags?.includes(tag)),
            );
        }
        return true;
      })
      .map(([id, config]) => {
        const aggregateTags =
          config.clusterSpecificConfigs?.reduce((prev, curr) => {
            curr.config.tags?.forEach((tag) => {
              if (!prev.has(tag)) {
                prev.add(tag);
              }
            });
            return prev;
          }, new Set(config.tags)) ||
          config.tags ||
          [];

        return {
          id,
          name: config.name,
          logoPath: config.logoPath,
          tags: Array.from(aggregateTags),
          appComment: getI18nConfigCurrentText(config.appComment, undefined),
        };
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
