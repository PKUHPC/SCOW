import { EntityManager } from "@mikro-orm/mysql";
import { AppConfigSchema } from "@scow/config/build/appForAi";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { normalizePathForValidation, validateContainerMountTargetPath, validateHomeScopedPath } from "@scow/utils";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { PREDEFINED_ENV_VAR, shouldOmitEnvFromPayload } from "src/models/envVars";
import { getAiAppConfigs } from "src/server/config/apps";
import { AlgorithmVersion, SharedStatus } from "src/server/entities/AlgorithmVersion";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { Image as ImageEntity } from "src/server/entities/Image";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { Logger } from "ts-log";
import { z } from "zod";

import { clusters } from "../trpc/route/config";
import { CreateDevHostInput } from "../trpc/route/devHost/devHost";
import { CreateAppInput, ExtraDisplayInputs } from "../trpc/route/jobs/apps";
import { InferenceJobInput } from "../trpc/route/jobs/infer";
import { TrainJobInput } from "../trpc/route/jobs/jobs";
import { wrap } from "../trpc/scowd/scowd";
import { DetailedTRPCError } from "./detailedError";
import { getImageAddressValidationResult } from "./image";
import { logger } from "./logger";

export const getClusterAppConfigs = (cluster: string) => {
  const commonApps = getAiAppConfigs();

  const clusterAppsConfigs = getAiAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));

  const apps: Record<string, AppConfigSchema> = {};

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  for (const [key, value] of Object.entries(clusterAppsConfigs)) {
    apps[key] = value;
  }

  return apps;
};

type AppConfigWithClusterSpecific = AppConfigSchema & {
  clusterSpecificConfigs?: {
    cluster: string;
    config: AppConfigSchema;
  }[];
};

export const getAllAppConfigs = (clusters: Record<string, ClusterConfigSchema>) => {
  const commonApps = getAiAppConfigs();

  const apps: Record<string, AppConfigWithClusterSpecific> = {};

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  Object.keys(clusters).forEach((cluster) => {
    const clusterAppsConfigs = getAiAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));
    for (const [key, value] of Object.entries(clusterAppsConfigs)) {
      const specificConfig = {
        cluster,
        config: value,
      };

      // 集群独有的应用，直接用集群配置
      if (!apps[key]) apps[key] = value;

      if (apps[key].clusterSpecificConfigs) {
        apps[key].clusterSpecificConfigs?.push(specificConfig);
      } else {
        apps[key].clusterSpecificConfigs = [specificConfig];
      }
    }
  });

  return apps;
};

export const allApps = getAllAppConfigs(clusters);

// 获取所有应用的标签集合
export const getAllTags = (allApps: Record<string, AppConfigWithClusterSpecific>): string[] => {
  const allTags = new Set<string>();

  Object.values(allApps).forEach((appConfig) => {
    appConfig.tags?.forEach((tag) => allTags.add(tag));
    appConfig.clusterSpecificConfigs?.forEach((clusterConfig) => {
      clusterConfig.config.tags?.forEach((tag) => allTags.add(tag));
    });
  });

  return Array.from(allTags);
};

// 批量查询版本并保持原顺序
/**
 *
 * @param em
 * @param entity  实体类，如 AlgorithmVersion、DatasetVersion、ModelVersion
 * @param ids 要查询的 ID 数组
 * @param populate 需要填充的字段
 * @param entityName 用于错误消息
 * @returns
 */
const getVersions = async <T>(
  em: EntityManager,
  entity: any,
  ids: number[],
  populate: any[],
  entityName: string,
): Promise<T[]> => {
  // 去重并保持顺序
  const uniqueIds = [...new Set(ids)];

  // 批量查询版本
  const versions = await em.find(entity, { id: { $in: uniqueIds } }, { populate });

  // 检查是否所有版本都存在
  const missingIds = uniqueIds.filter((id) => !versions.some((version: any) => version.id === id));
  if (missingIds.length > 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${entityName} version(s) ${missingIds.join(", ")} not found`,
    });
  }

  // 保持原 ID 数组的顺序，包括重复的 ID
  return ids.map((id) => {
    const foundVersion = versions.find((version: any) => version.id === id);
    if (!foundVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `${entityName} version id ${id} is not found`,
      });
    }

    return foundVersion as T;
  });
};

/**
 * @param orm mikro-orm
 * @param datasets dataset version ids
 * @param algorithms algorithm version ids
 * @param image image id
 * @param models model version ids
 * @returns datasetVersion, algorithmVersion, modelVersion, image
 * @throws TRPCError if dataset, algorithm, image, model is not found
 */
export const checkCreateAppEntity = async ({
  em,
  datasets,
  algorithms,
  image,
  models,
}: {
  em: EntityManager;
  datasets: number[] | undefined;
  algorithms: number[] | undefined;
  image: number | undefined;
  models: number[] | undefined;
}) => {
  const algorithmVersions = algorithms
    ? await getVersions<AlgorithmVersion>(em, AlgorithmVersion, algorithms, ["algorithm"], "algorithm")
    : [];

  const datasetVersions = datasets
    ? await getVersions<DatasetVersion>(em, DatasetVersion, datasets, ["dataset"], "dataset")
    : [];

  const modelVersions = models ? await getVersions<ModelVersion>(em, ModelVersion, models, ["model"], "model") : [];

  let imageOutput: ImageEntity | undefined;
  if (image !== undefined) {
    const existImage = await em.findOne(ImageEntity, { id: image });

    if (!existImage) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `image id ${image} is not found`,
      });
    }
    imageOutput = existImage;
  }

  return {
    datasetVersions,
    algorithmVersions,
    modelVersions,
    image: imageOutput,
  };
};

export const checkAppExist = (apps: Record<string, AppConfigSchema>, appId: string) => {
  const app = apps[appId];
  if (!app) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `app id ${appId} is not found`,
    });
  }
  return app;
};

const normalizeLegacyMountPoints = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const record = input as Record<string, unknown>;
  const mountPoints = record.mountPoints;
  if (!Array.isArray(mountPoints)) {
    return input;
  }

  const normalizedMountPoints = mountPoints.map((point) => {
    if (typeof point === "string") {
      return {
        path: point,
        target: point,
      };
    }
    return point;
  });

  return {
    ...record,
    mountPoints: normalizedMountPoints,
  };
};

export const scowdFetchJobInputParams = async <T>(
  userId: string,
  inputParamsPath: string,
  scowdClient: ScowdClient,
  schema: z.ZodSchema<T>,
  logger: Logger,
): Promise<T> => {
  const inputContent = await wrap(
    scowdClient.file.readFile({
      userId,
      filePath: inputParamsPath,
    }),
    logger,
  );
  const parsedContent = JSON.parse(inputContent.content.toString());
  const normalizedContent = normalizeLegacyMountPoints(parsedContent);
  return schema.parse(normalizedContent);
};

export const validateUniquePaths = (paths: (string | undefined)[]) => {
  // 移除尾随斜杠并返回规范化的路径
  const normalizedPaths = paths.map((path) => path?.replace(/\/+$/, ""));
  const pathSet = new Set();

  for (const path of normalizedPaths) {
    if (path && pathSet.has(path)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `路径 '${path}' 重复，请确保所有路径都是唯一的。`,
      });
    }
    if (path) {
      pathSet.add(path);
    }
  }
};

export const genPublicOrPrivateDataJsonString = (path: string | undefined, isPublic: boolean, target?: string) =>
  JSON.stringify({ path, isPublic, target });

const checkEntityAccess = ({
  entity,
  userId,
  sharedStatus,
  entityId,
}: {
  entity: { owner: string } | undefined;
  userId: string;
  sharedStatus: SharedStatus | undefined;
  entityId: string | undefined;
}) => {
  if (entity && entity.owner !== userId && sharedStatus !== SharedStatus.SHARED) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${entityId} is not accessible`,
    });
  }
};

export const checkEntityAuth = ({
  datasetVersions,
  algorithmVersions,
  modelVersions,
  image,
  userId,
}: {
  datasetVersions: DatasetVersion[];
  algorithmVersions: AlgorithmVersion[];
  modelVersions: ModelVersion[];
  image: ImageEntity | undefined;
  userId: string;
}) => {
  datasetVersions.forEach((datasetVersion) => {
    checkEntityAccess({
      entity: datasetVersion.dataset.getEntity(),
      userId,
      sharedStatus: datasetVersion?.sharedStatus,
      entityId: `dataset version id ${datasetVersion?.id}`,
    });
  });

  algorithmVersions.forEach((algorithmVersion) => {
    checkEntityAccess({
      entity: algorithmVersion.algorithm.getEntity(),
      userId,
      sharedStatus: algorithmVersion.sharedStatus,
      entityId: `algorithm version id ${algorithmVersion?.id}`,
    });
  });

  modelVersions.forEach((modelVersion) => {
    checkEntityAccess({
      entity: modelVersion.model.getEntity(),
      userId,
      sharedStatus: modelVersion.sharedStatus,
      entityId: `model version id ${modelVersion?.id}`,
    });
  });

  if (image && image.owner !== userId && !image.isShared) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `image id ${image.id} is not accessible`,
    });
  }
};

// 封装在作业详情增加的 input.json 中的额外展示内容
export function formatJobDetailsExtraInputs(
  inputParams: CreateAppInput | TrainJobInput | InferenceJobInput | CreateDevHostInput,
  extraDisplayInputs: ExtraDisplayInputs,
): ExtraDisplayInputs {
  const hasTarget = (target: string | undefined) => Boolean(target?.trim());

  const getResourceNames = (items: { currentNameVersion?: string; target?: string }[] | undefined) =>
    items
      ?.filter((item) => item.currentNameVersion !== undefined && !hasTarget(item.target))
      .map((item) => item.currentNameVersion) ?? [];

  const getResourceMounts = (items: { currentNameVersion?: string; target?: string }[] | undefined) =>
    items
      ?.filter(
        (item): item is { currentNameVersion: string; target: string } =>
          item.currentNameVersion !== undefined && hasTarget(item.target),
      )
      .map((item) => ({ name: item.currentNameVersion, target: item.target })) ?? [];

  const localImageName = "localImageName" in inputParams ? inputParams.localImageName : undefined;
  const models = "models" in inputParams ? inputParams.models : undefined;

  const result = {
    ...extraDisplayInputs,
    ...inputParams,
    isDefaultImage: !inputParams.remoteImageUrl && !inputParams.image,
    imageNameOrUrl: inputParams.image ? localImageName : inputParams.remoteImageUrl,
    modelNames: getResourceNames(models),
    modelMounts: getResourceMounts(models),
    startCommand:
      "startCommand" in inputParams
        ? inputParams.startCommand
        : "command" in inputParams
          ? inputParams.command
          : undefined,
    mountPoints:
      "mountPoints" in inputParams
        ? (inputParams.mountPoints ?? []).map((point) => {
            const path = point?.path ?? "";
            const target = point?.target ?? "";
            return {
              path,
              target,
            };
          })
        : undefined,
  };

  if ("datasets" in inputParams && "algorithms" in inputParams) {
    return {
      ...result,
      datasetNames: getResourceNames(inputParams.datasets),
      datasetMounts: getResourceMounts(inputParams.datasets),
      algorithmNames: getResourceNames(inputParams.algorithms),
      algorithmMounts: getResourceMounts(inputParams.algorithms),
    };
  }

  return result;
}

const NON_UTF8_PREFIX = "scow-enc-";

export const hasNonUtf8Segment = (targetPath: string) =>
  targetPath
    .split("/")
    .filter(Boolean)
    .some((segment) => segment.startsWith(NON_UTF8_PREFIX));

const throwPathValidationError = (message: string) => {
  throw new DetailedTRPCError({
    code: "BAD_REQUEST",
    message,
    detail: {
      type: "path_validation_failed",
      message,
    },
  });
};

export const validateMountPoints = (mountPoints: { path: string; target: string }[], homeDir: string) => {
  mountPoints.forEach(({ path, target }) => {
    const sourceError = validateHomeScopedPath(path, homeDir);
    if (sourceError) {
      throwPathValidationError(sourceError);
    }

    const targetError = validateContainerMountTargetPath(target);
    if (targetError) {
      throwPathValidationError(targetError);
    }
  });
};

export const validateResourceMountTargets = (items: { target: string }[]) => {
  items.forEach(({ target }) => {
    if (!target) {
      return;
    }

    const error = validateContainerMountTargetPath(target);
    if (error) {
      throwPathValidationError(error);
    }
  });
};

export const validateUniqueMountTargets = (targets: (string | undefined)[]) => {
  const targetSet = new Set<string>();

  targets.forEach((target) => {
    if (!target) {
      return;
    }

    const normalizedTarget = normalizePathForValidation(target);
    if (targetSet.has(normalizedTarget)) {
      throwPathValidationError(`Mount target path '${target}' is duplicated`);
    }

    targetSet.add(normalizedTarget);
  });
};

export const validateOptionalHomeScopedPath = (path: string | undefined, homeDir: string) => {
  if (!path) {
    return;
  }

  const error = validateHomeScopedPath(path, homeDir);
  if (error) {
    throwPathValidationError(error);
  }
};

export const validateRemoteImageUrl = (remoteImageUrl: string | undefined) => {
  if (!remoteImageUrl) {
    return;
  }

  const { isValidAddress, isHarborAddress, validationReasons } = getImageAddressValidationResult(remoteImageUrl);
  if (!isValidAddress || isHarborAddress) {
    logger.warn(
      {
        remoteImageUrl,
        isValidAddress,
        isHarborAddress,
        validationReasons,
      },
      "Rejected remote image address during job submission",
    );
    const message = `Remote image address ${remoteImageUrl} is not valid.`;
    throw new DetailedTRPCError({
      code: "BAD_REQUEST",
      message,
      detail: {
        type: "image_address_validation_failed",
        message,
      },
    });
  }
};

/**
 * 从 envVariables 中提取 WORK_DIR，并校验其必须存在且位于 homeDir 下。
 * 不满足条件时直接抛出 TRPCError，调用方无需额外处理。
 */
export const extractAndValidateWorkDir = (envVariables: { key: string; value: string }[], homeDir: string): string => {
  const workingDirectory = envVariables.find((e) => e.key === PREDEFINED_ENV_VAR.WORK_DIR)?.value;

  if (!workingDirectory) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "WORK_DIR is required",
    });
  }

  const error = validateHomeScopedPath(workingDirectory, homeDir);
  if (error) {
    throwPathValidationError(error);
  }

  return workingDirectory;
};

export const filterReservedEnvVars = (envVariables: { key: string; value: string }[]) =>
  envVariables.filter((e) => !shouldOmitEnvFromPayload(e.key));
