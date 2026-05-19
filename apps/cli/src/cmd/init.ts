import { existsSync, promises as fsp } from "fs";
import { basename, join } from "path";
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

// fs.promise.cp throws error for config dir
async function copyWithWarning(src: string, dest: string) {
  const stat = await fsp.lstat(src);
  const destPath = join(dest, basename(src));

  if (stat.isDirectory()) {
    if (!existsSync(destPath)) {
      await fsp.mkdir(destPath, { recursive: true });
    }

    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcDir = join(src, entry.name);
      await copyWithWarning(srcDir, destPath);
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
    await fsp.copyFile(src, destPath);
  }
}

export const init = async (options: Options) => {
  const fullPath = join(process.cwd(), options.outputPath);

  logger.info("Output path is %s. ", fullPath);

  const assets = options.full ? initAllAssets : initAssets;

  for (const asset of assets) {
    await copyWithWarning(asset, fullPath);
  }

  logger.info("File initialization complete");
};
