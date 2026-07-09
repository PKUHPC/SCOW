import { getPortalConfig } from "@scow/config/build/portal";
import { logger } from "src/utils/logger";

export const portalConfig = getPortalConfig(undefined, logger);
