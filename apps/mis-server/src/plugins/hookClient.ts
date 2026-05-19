import { createHookClient } from "@scow/lib-hook";
import { commonConfig } from "src/config/common";
import { logger } from "src/utils/logger";

export const { callHook } = createHookClient(commonConfig.scowHook, logger);
