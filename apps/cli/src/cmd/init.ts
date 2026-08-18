import { randomBytes } from "crypto";
import { existsSync, promises as fsp } from "fs";
import { load } from "js-yaml";
import { basename, dirname, extname, join } from "path";
import prompt from "prompts";
import { logger } from "src/log";

interface Options {
  outputPath: string;
  // 是否展示所有配置项
  full: boolean;
}

// For pkg executables, assets are in the snapshot filesystem
// We need to use the path relative to where pkg places them
const assetsBasePath = (process as any).pkg
  ? join(__dirname, "../assets") // In pkg, __dirname is at the root of the snapshot
  : join(__dirname, "../../assets"); // In development, go up from build/cmd

const SCOW_API_TOKEN_PLACEHOLDER = "must-change-this-scow-api-token";
const SCOW_API_TOKEN_MIN_LENGTH = 32;
const COMMON_CONFIG_FILENAMES = ["common.yml", "common.yaml", "common.json"];
const initFullCommonConfigPath = join(assetsBasePath, "init-full/config/common.yml");
const initCommonConfigPath = join(assetsBasePath, "init/config/common.yaml");
const commonConfigAssetPaths = new Set([initFullCommonConfigPath, initCommonConfigPath]);

const initAllAssets = [
  join(assetsBasePath, "init-full/install.yaml"),
  join(assetsBasePath, "init-full/config"),
  join(assetsBasePath, "init-full/fluent"),
  join(assetsBasePath, "init-full/plugins"),
  join(assetsBasePath, "init-full/public"),
  join(assetsBasePath, "init-full/quantum"),
];

const initAssets = [
  join(assetsBasePath, "init/install.yaml"),
  join(assetsBasePath, "init/config"),
  join(assetsBasePath, "init/fluent"),
  join(assetsBasePath, "init/plugins"),
  join(assetsBasePath, "init/public"),
  join(assetsBasePath, "init/quantum"),
];

const getScowApiToken = (config: unknown): string | undefined => {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const scowApi = (config as Record<string, unknown>).scowApi;
  if (!scowApi || typeof scowApi !== "object") {
    return undefined;
  }

  const auth = (scowApi as Record<string, unknown>).auth;
  if (!auth || typeof auth !== "object") {
    return undefined;
  }

  const token = (auth as Record<string, unknown>).token;
  return typeof token === "string" &&
    Array.from(token).length >= SCOW_API_TOKEN_MIN_LENGTH &&
    token !== SCOW_API_TOKEN_PLACEHOLDER
    ? token
    : undefined;
};

interface ExistingScowApiToken {
  configPath: string;
  token: string;
}

const readExistingScowApiToken = async (configDir: string): Promise<ExistingScowApiToken | undefined> => {
  for (const filename of COMMON_CONFIG_FILENAMES) {
    const configPath = join(configDir, filename);
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      const content = await fsp.readFile(configPath, "utf8");
      const config = extname(configPath) === ".json" ? JSON.parse(content) : load(content);
      const token = getScowApiToken(config);
      if (!token) {
        logger.warn(
          "Existing common config %s does not contain a valid SCOW API token. A new token will be generated.",
          configPath,
        );
        return undefined;
      }

      return { configPath, token };
    } catch {
      logger.warn(
        "Failed to read existing common config %s. A new SCOW API token will be generated.",
        configPath,
      );
      return undefined;
    }
  }

  return undefined;
};

const writeCommonConfig = async (src: string, dest: string, generatedToken: string) => {
  const template = await fsp.readFile(src, "utf8");
  if (!template.includes(SCOW_API_TOKEN_PLACEHOLDER)) {
    throw new Error(`SCOW API token placeholder is missing from ${src}`);
  }

  const existingToken = await readExistingScowApiToken(dirname(dest));
  const token = existingToken?.token ?? generatedToken;
  await fsp.writeFile(dest, template.replace(SCOW_API_TOKEN_PLACEHOLDER, JSON.stringify(token)));

  if (existingToken) {
    logger.info("Preserved existing SCOW API token from %s in %s", existingToken.configPath, dest);
  } else {
    logger.info("Generated a new SCOW API token in %s", dest);
  }
};

// fs.promise.cp throws error for config dir
async function copyWithWarning(src: string, dest: string, generatedToken: string) {
  const stat = await fsp.lstat(src);
  const destPath = join(dest, basename(src));

  if (stat.isDirectory()) {
    if (!existsSync(destPath)) {
      await fsp.mkdir(destPath, { recursive: true });
    }

    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcDir = join(src, entry.name);
      await copyWithWarning(srcDir, destPath, generatedToken);
    }
  } else {
    if (existsSync(destPath)) {
      const answer = await prompt({
        type: "confirm",
        name: "continue",
        message: `Output ${destPath} already exists. Overwrite?`,
      });
      if (!answer.continue) {
        logger.debug("Selected no.");
        return;
      }
    }

    logger.info("Copying %s to %s", src, destPath);
    if (commonConfigAssetPaths.has(src)) {
      await writeCommonConfig(src, destPath, generatedToken);
    } else {
      await fsp.copyFile(src, destPath);
    }
  }
}

export const init = async (options: Options) => {
  const fullPath = join(process.cwd(), options.outputPath);

  logger.info("Output path is %s. ", fullPath);

  const assets = options.full ? initAllAssets : initAssets;
  const scowApiToken = randomBytes(32).toString("base64url");

  for (const asset of assets) {
    await copyWithWarning(asset, fullPath, scowApiToken);
  }

  logger.info("File initialization complete");
};
