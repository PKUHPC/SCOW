import { getClusterConfigs } from "@scow/config/build/cluster";
import { logger } from "src/utils/logger";

export const clusters = getClusterConfigs(undefined, logger);
