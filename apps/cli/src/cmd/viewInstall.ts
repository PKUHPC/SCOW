import { getInstallConfig } from "src/config/install";
import { format } from "src/utils/formatter";

interface Options {
  configPath: string;
  format: string;
}

/**
 * Output sample config files to console
 * @param options options
 */
export const viewInstall = (options: Options) => {
  const config = getInstallConfig(options.configPath);
  console.log(format(config, options.format));
};
