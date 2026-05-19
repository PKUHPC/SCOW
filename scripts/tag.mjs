/**
 * Compare the version of the current package.json and protos/package.json with the version of the last commit
 * If the version is changed, create a tag and push it to the remote repository
 *
 * Usage:
 *   node scripts/tag.mjs
 *   node scripts/tag.mjs --dry-run: only print the command to be executed
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";

const dryRun = process.argv.includes("--dry-run");

const exec = (cmd) => {
  if (!dryRun) {
    execSync(cmd, { stdio: "inherit", encoding: "utf-8" });
  } else {
    console.log("Trying to run command: %s", cmd);
  }
};

function getVersion(path) {
  const lastFile = execSync(`git --no-pager show HEAD^1:${path}`, { encoding: "utf-8" });

  const currentFile = readFileSync(path, { encoding: "utf-8" });

  const last = JSON.parse(lastFile).version;

  const current = JSON.parse(currentFile).version;

  return { last, current };
}

// Tag SCOW Release
let changed = false;
const rootVersion = getVersion("package.json");

if (rootVersion.current !== rootVersion.last) {
  changed = true;
  console.log("App version is changed from %s to %s", rootVersion.last, rootVersion.current);
  exec(`git tag -a v${rootVersion.current} -m 'SCOW Release v${rootVersion.current}'`);
} else {
  console.log("App version %s is not changed.", rootVersion.current);
}

// Tag SCOW API Release
const scowApiVersion = getVersion("protos/package.json");

if (scowApiVersion.current !== scowApiVersion.last) {
  changed = true;
  console.log("SCOW API version is changed from %s to %s", scowApiVersion.last, scowApiVersion.current);
  exec(`git tag -a api-v${scowApiVersion.current} -m 'SCOW API Release v${scowApiVersion.current}'`);
} else {
  console.log("SCOW API Version %s is not changed.", scowApiVersion.current);
}

if (changed) {
  console.log("New Tag Created. Push tags.");
  exec("git push --tags");
}
