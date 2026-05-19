/**
 * Create a json file at the specified path
 * containing the commit number and tag number of current commit
 *
 * Usage:
 *   node scripts/createVersionFile.mjs [json file path]
 *
 *   e.g. node scripts/createVersionFile.mjs version.json
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let outputFile = process.argv[2] || "version.json";

const exec = (cmd) => execSync(cmd, { encoding: "utf-8" });

const tags = exec("git tag --points-at HEAD").split("\n");
const commit = exec("git rev-parse HEAD").trim();

const versionObject = {
  tag: tags[0] || undefined,
  commit,
};

writeFileSync(outputFile, JSON.stringify(versionObject));
