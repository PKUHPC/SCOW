import { EntityManager } from "@mikro-orm/mysql";
import { AppConfigSchema } from "@scow/config/build/appForAi";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { sftpExists, sftpReadFile } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { getAiAppConfigs } from "src/server/config/apps";
import { AlgorithmVersion, SharedStatus } from "src/server/entities/AlgorithmVersion";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { Image as ImageEntity } from "src/server/entities/Image";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { SFTPWrapper } from "ssh2";
import { Logger } from "ts-log";
import { z } from "zod";

import { clusters } from "../trpc/route/config";
import { CreateAppInput, ExtraDisplayInputs } from "../trpc/route/jobs/apps";
import { InferenceJobInput } from "../trpc/route/jobs/infer";
import { TrainJobInput } from "../trpc/route/jobs/jobs";
import { wrap } from "../trpc/scowd/scowd";

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
    cluster: string,
    config: AppConfigSchema,
  }[]
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
  const versions = await em.find(entity,
    { id: { $in: uniqueIds } },
    { populate },
  );

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
export const checkCreateAppEntity = async ({ em, datasets, algorithms, image, models }: {
  em: EntityManager,
  datasets: number[] | undefined,
  algorithms: number[] | undefined,
  image: number | undefined,
  models: number[] | undefined
}) => {

  const algorithmVersions = algorithms ? await getVersions<AlgorithmVersion>(
    em,
    AlgorithmVersion,
    algorithms,
    ["algorithm"],
    "algorithm",
  ) : [];

  const datasetVersions = datasets ? await getVersions<DatasetVersion>(
    em,
    DatasetVersion,
    datasets,
    ["dataset"],
    "dataset",
  ) : [];

  const modelVersions = models ? await getVersions<ModelVersion>(
    em,
    ModelVersion,
    models,
    ["model"],
    "model",
  ) : [];

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


export const sshFetchJobInputParams = async<T> (
  inputParamsPath: string,
  sftp: SFTPWrapper,
  schema: z.ZodSchema<T>,
  logger: Logger,
): Promise<T> => {

  if (!await sftpExists(sftp, inputParamsPath)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Input params file ${inputParamsPath} is not found`,
    });
  }

  try {
    const inputContent = await sftpReadFile(sftp)(inputParamsPath);
    const parsedContent = JSON.parse(inputContent.toString());
    return schema.parse(parsedContent);
  } catch (e) {

    logger.error(`Failed to parse input params file ${inputParamsPath}: ${e as any}`);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to parse input params file ${inputParamsPath}`,
    });
  }
};

export const scowdFetchJobInputParams = async<T> (
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
  return schema.parse(parsedContent);
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

export const genPublicOrPrivateDataJsonString = (path: string | undefined,isPublic: boolean) =>
  JSON.stringify({ path,isPublic });

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

export const checkEntityAuth = ({ datasetVersions, algorithmVersions,modelVersions, image, userId }: {
  datasetVersions: DatasetVersion [],
  algorithmVersions: AlgorithmVersion[],
  modelVersions: ModelVersion [],
  image: ImageEntity | undefined,
  userId: string,
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
  inputParams: CreateAppInput | TrainJobInput | InferenceJobInput,
  extraDisplayInputs: ExtraDisplayInputs,
): ExtraDisplayInputs {

  const result = {
    ...extraDisplayInputs,
    ...inputParams,
    isDefaultImage: (!inputParams.remoteImageUrl && !inputParams.image),
    imageNameOrUrl: inputParams.image ? inputParams.localImageName : inputParams.remoteImageUrl,
    modelNames:
    inputParams.models ?
      inputParams.models
        .filter((x) => x.currentNameVersion !== undefined)
        .map((m) => m.currentNameVersion)
      : [],
    startCommand: "startCommand" in inputParams
      ? inputParams.startCommand
      : "command" in inputParams
        ? inputParams.command
        : undefined,
  };

  if ("datasets" in inputParams && "algorithms" in inputParams) {
    return {
      ... result,
      datasetNames:
      inputParams.datasets ?
        inputParams.datasets
          .filter((x) => x.currentNameVersion !== undefined)
          .map((d) => d.currentNameVersion)
        : [],
      algorithmNames:
        inputParams.algorithms ?
          inputParams.algorithms
            .filter((x) => x.currentNameVersion !== undefined)
            .map((a) => a.currentNameVersion)
          : [],
    };
  }

  return result;

}
