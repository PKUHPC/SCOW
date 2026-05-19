import { getClientFn } from "@scow/lib-web/build/utils/api";
import { publicConfig, runtimeConfig } from "src/utils/config";

export const getClient = getClientFn(runtimeConfig);

export const getAuditClient =
  publicConfig.AUDIT_DEPLOYED && runtimeConfig.AUDIT_CONFIG?.url
    ? getClientFn({ SERVER_URL: runtimeConfig.AUDIT_CONFIG.url })
    : undefined;
