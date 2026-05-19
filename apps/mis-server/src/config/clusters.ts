import { getClusterConfigs } from "@scow/config/build/cluster";
import { logger } from "src/utils/logger";

export const configClusters = getClusterConfigs(undefined, logger);
