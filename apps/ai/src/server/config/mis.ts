import { getMisConfig } from "@scow/config/build/mis";
import { logger } from "src/server/utils/logger";

export const misConfig = getMisConfig(undefined, logger);
