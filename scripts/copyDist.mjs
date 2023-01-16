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

/**
 * Copy the required files of the app and the dependent libs to dist folder.
 * The files specified in the `files` fields of package.json of the app and libs will be copied.
 *
 * Usage:
  *  node scripts/copyDist.mjs [appDir]
  *
  *  e.g. node scripts/copyDist.mjs apps/mis-server
 *
 * If appDir is not specified, the script will use the only app under apps folder.
 * If there are multiple apps under apps folder, an error will be thrown.
 */

import fs from "node:fs";
import path, { join } from "node:path";

import { readWantedLockfile } from "@pnpm/lockfile-file";
import { globby } from "globby";
import { rimraf } from "rimraf";

const APPS_BASE_PATH = "apps";
const DIST_BASE_PATH = "dist";

const ROOT_ITEMS = ["package.json", "pnpm-lock.yaml", ".npmrc", "pnpm-workspace.yaml"];
const DEFAULT_COPY_ITEMS = ["package.json"];

const lockFile = await readWantedLockfile(".", {});

if (!lockFile) { throw new Error("No lockfile found"); }

// apps/mis-server
let appDir = process.argv[2];

if (!appDir) {
  const apps = await fs.promises.readdir(APPS_BASE_PATH);
  if (apps.length !== 1) {
    throw new Error(`Expected one project under ${APPS_BASE_PATH}.`);
  }
  appDir = join(APPS_BASE_PATH, apps[0]);
}

/**
 * Get files specified in the packages
 * @param {string} packageRoot
 * @returns {Promise<string[]>}
 */
const getRequiredFiles = async (packageRoot) => {

  // get the package.json of the app
  const packageJson = JSON.parse(
    await fs.promises.readFile(`${packageRoot}/package.json`, { encoding: "utf-8" }),
  );

  // get the required files for the app
  if (!packageJson.files) {
    throw new Error("No files specified in package.json of " + packageRoot);
  }
  return DEFAULT_COPY_ITEMS.concat(packageJson.files);

};

// create dist folder
console.log("Creating dist folder ", DIST_BASE_PATH);
await fs.promises.mkdir(DIST_BASE_PATH, { recursive: true });

const cleanTsFiles = async (dir) => {
  // find all deleted files
  if (!(await fs.promises.stat(dir)).isDirectory()) {
    return;
  }
  const files = await globby(["**/*.ts", "**/*.map"].map((p) => path.posix.join(dir, p)));
  await rimraf(files);
};

const cp = async (source, target) => {
  await fs.promises.cp(source, target, { recursive: true });
};

// Copy root items
for (const item of ROOT_ITEMS) {
  await cp(item, join(DIST_BASE_PATH, item));
}

// copy lib depepdencies
const snapshot = lockFile.importers[appDir];

for (const [name, value] of Object.entries(snapshot.dependencies)) {
  if (!name.startsWith("@scow/")) { continue; }

  console.log("Handling internal dep", name);
  const libDir = value.substring("link:../../".length);

  const requiredFiles = await getRequiredFiles(libDir);
  for (const file of requiredFiles) {

    const from = join(libDir, file);
    const to = join(DIST_BASE_PATH, libDir, file);

    await cp(from, to);
    await cleanTsFiles(to);
  }
}

// copy app
const requiredFiles = await getRequiredFiles(appDir);
for (const file of requiredFiles) {

  const from = join(appDir, file);
  const to = join(DIST_BASE_PATH, appDir, file);

  await cp(from, to);
  await cleanTsFiles(to);
}
