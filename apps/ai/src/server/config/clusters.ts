import { getClusterConfigs } from "@scow/config/build/cluster";
import { logger } from "src/server/utils/logger";

export const clusters = getClusterConfigs(undefined, logger, ["ai"]);
