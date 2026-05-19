import { getAuditConfig } from "@scow/config/build/audit";
import { logger } from "src/utils/logger";

export const auditConfig = getAuditConfig(undefined, logger);
