import { createHookClient } from "@scow/lib-hook";
import { logger } from "src/utils/logger";

import { commonConfig } from "./config/common";

export const { callHook } = createHookClient(commonConfig.scowHook, logger);
