import { writeFileSync } from "fs";
import { createComposeSpec } from "src/compose";
import { getInstallConfig } from "src/config/install";
import { logger } from "src/log";
import { format } from "src/utils/formatter";

interface Options {
  configPath: string;
  outputPath: string;
  format: string;
}

/**
 * Generate docker-compose.yml file on outputPath from config
 * @param options config
 */
export const generateDockerComposeYml = (options: Options) => {
  const config = getInstallConfig(options.configPath);

  const spec = createComposeSpec(config);

  writeFileSync(options.outputPath, format(spec, options.format), { encoding: "utf-8" });

  logger.info("Generated compose spec as %s at %s", options.format, options.outputPath);
};
