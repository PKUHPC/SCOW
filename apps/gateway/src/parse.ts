import { omitConfigSpec } from "@scow/lib-config";
import { readFileSync } from "fs";
import Handlebars from "handlebars";
import { type config } from "src/env";
import { joinUrlPath } from "src/unifiedWeb";

export function getNginxConfig(envConfig: typeof config): string {
  const templateSrc = readFileSync("assets/nginx.conf.hbs", "utf8");
  const template = Handlebars.compile(templateSrc, { noEscape: true });
  return template({
    ...omitConfigSpec(envConfig),
    UNIFIED_WEB_BASE_PATH: joinUrlPath(envConfig.BASE_PATH, envConfig.UNIFIED_WEB_PATH),
    UNIFIED_API_BASE_PATH: joinUrlPath(envConfig.BASE_PATH, "/api/unified"),
    PORTAL_API_UPSTREAM_PATH: joinUrlPath(envConfig.BASE_PATH, envConfig.PORTAL_PATH, "/api"),
    MIS_API_UPSTREAM_PATH: joinUrlPath(envConfig.BASE_PATH, envConfig.MIS_PATH, "/api"),
    AI_API_UPSTREAM_PATH: joinUrlPath(envConfig.BASE_PATH, envConfig.AI_PATH, "/api"),
    NOTIFICATION_API_UPSTREAM_PATH: joinUrlPath(envConfig.BASE_PATH, envConfig.NOTIFICATION_PATH, "/api"),
    QUANTUM_API_UPSTREAM_PATH: joinUrlPath(envConfig.BASE_PATH, envConfig.QUANTUM_PATH, "/api"),
  });
}
