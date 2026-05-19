import { getAiAppConfigs as libGetAiAppConfigs } from "@scow/config/build/appForAi";

export const getAiAppConfigs = (clusterBasePath?: string) => libGetAiAppConfigs(clusterBasePath);
