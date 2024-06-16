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

import { EntityManager } from "@mikro-orm/mysql";
import { AppConfigSchema } from "@scow/config/build/appForAi";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { sftpExists, sftpReadFile } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { getAiAppConfigs } from "src/server/config/apps";
import { AlgorithmVersion } from "src/server/entities/AlgorithmVersion";
import { DatasetVersion } from "src/server/entities/DatasetVersion";
import { Image as ImageEntity } from "src/server/entities/Image";
import { ModelVersion } from "src/server/entities/ModelVersion";
import { SFTPWrapper } from "ssh2";
import { Logger } from "ts-log";
import { z } from "zod";

import { clusters } from "../trpc/route/config";


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
}


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



/**
 * @param orm mikro-orm
 * @param dataset dataset version id
 * @param algorithm algorithm version id
 * @param image image id
 * @param model model version id
 * @returns datasetVersion, algorithmVersion, modelVersion, image
 * @throws TRPCError if dataset, algorithm, image, model is not found
 */
export const checkCreateAppEntity = async ({ em, dataset, algorithm, image, model }: {
  em: EntityManager
  dataset: number | undefined,
  algorithm: number | undefined,
  image: number | undefined,
  model: number | undefined
}) => {
  let algorithmVersion: AlgorithmVersion | undefined;
  if (algorithm !== undefined) {
    const selectAlgorithmVersion = await em.findOne(AlgorithmVersion, { id: algorithm });

    if (!selectAlgorithmVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `algorithm version id ${algorithm} is not found`,
      });
    }
    algorithmVersion = selectAlgorithmVersion;
  }

  let datasetVersion: DatasetVersion | undefined;
  if (dataset !== undefined) {
    const selectDatasetVersion = await em.findOne(DatasetVersion, { id: dataset });

    if (!selectDatasetVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `dataset version id ${dataset} is not found`,
      });
    }
    datasetVersion = selectDatasetVersion;
  }

  let modelVersion: ModelVersion | undefined;
  if (model !== undefined) {
    const selectedModelVersion = await em.findOne(ModelVersion, { id: model });
    if (!selectedModelVersion) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `model version id ${model} is not found`,
      });
    }
    modelVersion = selectedModelVersion;
  }

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
    datasetVersion,
    algorithmVersion,
    modelVersion,
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


export const fetchJobInputParams = async<T> (
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

    logger.error(`Failed to parse input params file ${inputParamsPath}: ${e}`);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to parse input params file ${inputParamsPath}`,
    });
  }
};

export const validateUniquePaths = (paths: (string | undefined)[]) => {

  // 移除尾随斜杠并返回规范化的路径
  const normalizedPaths = paths.map((path) => path && path.replace(/\/+$/, ""));
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
