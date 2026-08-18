import { readVersionFile } from "@scow/utils/build/version";
import { spawnSync } from "child_process";
import { cpSync, writeFileSync } from "fs";
import { config } from "src/env";
import { getNginxConfig } from "src/parse";
import { prepareUnifiedWebAssets } from "src/unifiedWeb";

console.log("@scow/gateway: ", readVersionFile());

if (config.UNIFIED_WEB_ENABLED) {
  prepareUnifiedWebAssets({
    basePath: config.BASE_PATH,
    unifiedWebPath: config.UNIFIED_WEB_PATH,
    sourceDir: config.UNIFIED_WEB_SOURCE_DIR,
    runtimeRoot: config.UNIFIED_WEB_RUNTIME_ROOT,
  });
}

const nginxConf = getNginxConfig(config);

writeFileSync("/etc/nginx/http.d/default.conf", nginxConf);

cpSync("assets/includes", "/etc/nginx/includes", { recursive: true });

spawnSync("nginx", ["-g", "daemon off;"], { stdio: "inherit" });
