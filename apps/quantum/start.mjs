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

import { execSync } from "child_process";
import { cpSync, existsSync, rmdirSync } from "fs";
import { replaceInFileSync } from "replace-in-file";

const BACKUP_DIR = ".next.backup";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Check if backup directory exists
if (existsSync(BACKUP_DIR)) {
  // If backup directory exists, delete .next directory and copy new .next from backup
  rmdirSync(".next", { recursive: true });
  cpSync(BACKUP_DIR, ".next", { recursive: true });
} else {
  // If backup directory does not exist, copy new backup from .next
  cpSync(".next", BACKUP_DIR, { recursive: true });
}

// If BASE_PATH == "/", change it to ""
const basePath = BASE_PATH === "/" ? "" : BASE_PATH;

// Replace @BASE_PATH@ in .next files
const options = {
  files: ".next/**/*.*",
  from: /\/@BASE_PATH@/g,
  to: basePath,
};

replaceInFileSync(options);

// Run serve:next
execSync("npm run serve:next", { stdio: "inherit", env: {
  ...process.env,
  NEXT_PUBLIC_RUNTIME_BASE_PATH: BASE_PATH,
} });
