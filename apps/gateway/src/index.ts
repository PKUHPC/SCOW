/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

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
