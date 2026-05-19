import { getAppConfigs as libGetAppConfigs } from "@scow/config/build/app";
import { getAiAppConfigs as libGetAiAppConfigs } from "@scow/config/build/appForAi";
import { AppConfigSchema as AiAppConfigSchema } from "@scow/config/build/appForAi";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { join } from "path";

import { logger } from "./logger";

export const getAppConfigs = (clusterBasePath?: string) => libGetAppConfigs(clusterBasePath, logger);

export const getClusterAppConfigs = (cluster: string) => {
  const commonApps = getAppConfigs();

  const clusterAppsConfigs = getAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));

  const apps = {} as Record<string, (typeof commonApps)[number]>;

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  for (const [key, value] of Object.entries(clusterAppsConfigs)) {
    apps[key] = value;
  }

  return apps;
};

export const getAiClusterAppConfigs = (cluster: string) => {
  const commonApps = libGetAiAppConfigs();

  const clusterAppsConfigs = libGetAiAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));

  const apps: Record<string, AiAppConfigSchema> = {};

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  for (const [key, value] of Object.entries(clusterAppsConfigs)) {
    apps[key] = value;
  }

  return apps;
};
