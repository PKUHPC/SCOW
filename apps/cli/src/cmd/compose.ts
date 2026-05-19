import { runComposeCommand } from "src/compose/cmd";
import { getInstallConfig } from "src/config/install";

interface Options {
  configPath: string;
  _: (string | number)[];
}

export const runCompose = async (options: Options, ...baseCommands: string[]) => {
  const config = getInstallConfig(options.configPath);

  await runComposeCommand(config, [...baseCommands, ...options._.slice(1).map((x) => String(x))]);
};
