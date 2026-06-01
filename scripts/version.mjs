/**
 * Execute pnpm changeset version to bump package versions, and bump root package.json version
 */

import { execSync } from "child_process";
import fm from "front-matter";
import fs, { existsSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const exec = (cmd) => execSync(cmd, { stdio: "inherit" });

/**
 * 1. Aggregate current changes by reading changeset files
 */
const CHANGESET_DIR = ".changeset";

const files = await readdir(CHANGESET_DIR);

const changes = {
  "portal-web": [],
  "portal-server": [],
  "mis-web": [],
  "mis-server": [],
  auth: [],
  cli: [],
  scowctl: [],
  gateway: [],
  "meta-server": [],
  "grpc-api": [],
  config: [],
  "scheduler-adapter-protos": [],
  ai: [],
  resource: [],
  notification: [],
};

for (const file of files) {
  if (!file.endsWith(".md") || file === "README.md") {
    continue;
  }
  const changesetFilePath = join(CHANGESET_DIR, file);

  const gitCommit = execSync(`git log -n 1 --pretty=format:%H -- ${changesetFilePath}`, {
    encoding: "utf-8",
  });

  const fileContent = await readFile(changesetFilePath, "utf8");
  const content = fm(fileContent);

  for (const [scowPackage, type] of Object.entries(content.attributes)) {
    const part = scowPackage.substring("@scow/".length);
    if (part in changes) {
      changes[part].push({ type, content: content.body.trim(), gitCommit });
    }
  }
}

/**
 * 2. Run changeset version to update versions of packages
 */
console.log("Run changeset version to bump package versions");
exec("pnpm changeset version");

/**
 * 3. Update root package version
 */
console.log("Update root package version");
const readPackageJson = (path) => JSON.parse(fs.readFileSync(path, { encoding: "utf8" }));
const rootPackageJson = readPackageJson("./package.json");

// read version from a app package
const portalWebPackageJson = readPackageJson("./apps/portal-web/package.json");

console.log("App version is %s. Root version is %s", portalWebPackageJson.version, rootPackageJson.version);

if (portalWebPackageJson.version === rootPackageJson.version) {
  console.log("App Version is not changed. Ignored.");
  process.exit(0);
}

console.log("App Version is changed. Update root package.json version");
rootPackageJson.version = portalWebPackageJson.version;
await writeFile("./package.json", JSON.stringify(rootPackageJson, null, 2));

/**
 * 4. Generate changelog
 */
console.log("Generate changelog for version %s", rootPackageJson.version);

const getChangesetLine = (line) =>
  `- ${line.content}` +
  ` ([${line.gitCommit.substring(0, 8)}](https://github.com/PKUHPC/private-scow/commit/${line.gitCommit}))`;

/**
 * Generate changelog content for a package
 * @param {string} scowPackage the package name
 * @param {string | undefined} title title. if not set, no title is shown
 * @returns changelog content
 */
const generateContent = (scowPackage, title) => {
  const packageChanges = changes[scowPackage];

  if (packageChanges.length === 0) {
    return "";
  }

  // categories changes by type

  const changesByType = { patch: [], minor: [], major: [] };

  for (const change of packageChanges) {
    changesByType[change.type].push(change);
  }

  let content = title ? `## ${title} (${scowPackage}) \n\n` : "";
  if (changesByType.major.length > 0) {
    content += "### 重大更新\n" + changesByType.major.map(getChangesetLine).join("\n") + "\n\n";
  }

  if (changesByType.minor.length > 0) {
    content += "### 重要更新\n" + changesByType.minor.map(getChangesetLine).join("\n") + "\n\n";
  }

  if (changesByType.patch.length > 0) {
    content += "### 小型更新\n" + changesByType.patch.map(getChangesetLine).join("\n") + "\n\n";
  }

  return content.trim() + "\n\n";
};

const generateNodesAboutSchedulerAdapterInterfaceVersion = () => {
  const packageChanges = changes["scheduler-adapter-protos"];

  if (packageChanges.length === 0) {
    return "";
  }

  let content = "# 适配器接口版本的要求变化\n\n";

  for (const change of packageChanges) {
    content += `- ${change.content}\n`;
  }

  return content;
};

const scowApiVersion = readPackageJson("protos/package.json").version;
const configVersion = readPackageJson("libs/config/package.json").version;

const changelogContent = `# v${rootPackageJson.version}

发布于：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

${generateNodesAboutSchedulerAdapterInterfaceVersion()}

# 配置文件

配置文件版本：${configVersion}

${generateContent("config")}
# SCOW API和Hook

SCOW API版本：${scowApiVersion}

${generateContent("grpc-api")}
# SCOW

${
  generateContent("portal-web", "门户系统前端") +
  generateContent("portal-server", "门户系统后端") +
  generateContent("mis-web", "管理系统前端") +
  generateContent("mis-server", "管理系统后端") +
  generateContent("auth", "认证系统") +
  generateContent("cli", "CLI") +
  generateContent("scowctl", "scowctl") +
  generateContent("gateway", "网关") +
  generateContent("meta-server", "元数据服务") +
  generateContent("ai", "AI系统") +
  generateContent("resource", "资源管理系统") +
  generateContent("notification", "消息系统")
}
`;

const CHANGELOG_BASE_PATH = "changelogs";

if (!existsSync(CHANGELOG_BASE_PATH)) {
  await mkdir(CHANGELOG_BASE_PATH);
}

const CHANGELOG_PATH = join(CHANGELOG_BASE_PATH, `v${rootPackageJson.version}.md`);
await writeFile(CHANGELOG_PATH, changelogContent);

console.log("Generated changelog at %s", CHANGELOG_PATH);
console.debug("Changelog content:\n%s", changelogContent);
