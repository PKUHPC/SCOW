import { getClientFn, type ClientConstructor } from "@scow/lib-web/build/utils/api";
import { runtimeConfig } from "src/utils/config";

export const getClient = getClientFn(runtimeConfig);

export const getAuditClient = <TClient>(ctor: ClientConstructor<TClient>): TClient =>
  getClientFn({ SERVER_URL: runtimeConfig.AUDIT_CONFIG.url })(ctor);
