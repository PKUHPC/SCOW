import { readVersionFile } from "@scow/utils/build/version";
import { spawnSync } from "child_process";
import { cpSync, writeFileSync } from "fs";
import { config } from "src/env";
import { getNginxConfig } from "src/parse";

console.log("@scow/gateway: ", readVersionFile());

const nginxConf = getNginxConfig(config);

writeFileSync("/etc/nginx/http.d/default.conf", nginxConf);

cpSync("assets/includes", "/etc/nginx/includes", { recursive: true });

spawnSync("nginx", ["-g", "daemon off;"], { stdio: "inherit" });
