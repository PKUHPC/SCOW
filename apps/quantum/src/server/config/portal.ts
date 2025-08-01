import { getPortalConfig } from "@scow/config/build/portal";
import { logger } from "src/server/utils/logger";

export const portalConfig = getPortalConfig(undefined, logger);


