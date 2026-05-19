import { getAppConfigs as libGetAppConfigs } from "@scow/config/build/app";
import { logger } from "src/utils/logger";

export const getAppConfigs = (clusterBasePath?: string) => libGetAppConfigs(clusterBasePath, logger);
