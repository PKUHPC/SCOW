import { runComposeCommand } from "src/compose/cmd";
import { getInstallConfig } from "src/config/install";

interface Options {
  configPath: string;
}

export const enterAiDb = async (options: Options) => {
  const config = getInstallConfig(options.configPath);

  if (!config.ai) {
    throw new Error("ai is not deployed. db is not deployed");
  }

  await runComposeCommand(config, ["exec", "ai-db", "mysql", "-uroot", `-p'${config.ai.dbPassword}'`]);
};
