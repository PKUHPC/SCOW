import { existsSync } from "fs";
import { InstallConfigSchema } from "src/config/install";
import { logger } from "src/log";

export interface Plugin {
  id: string;

  dockerComposeFilePath?: string;
}

const readPlugin = async (pluginsDir: string, id: string): Promise<Plugin | undefined> => {
  const pluginDir = `${pluginsDir}/${id}`;

  const dockerComposeConfigPath = `${pluginDir}/docker-compose.yml`;

  return {
    id,
    dockerComposeFilePath: existsSync(dockerComposeConfigPath) ? dockerComposeConfigPath : undefined,
  };
};

export const readEnabledPlugins = async (installConfig: Pick<InstallConfigSchema, "plugins">) => {
  const plugins = [] as Plugin[];

  if (installConfig.plugins.enabledPlugins) {
    for (const pluginId of installConfig.plugins.enabledPlugins) {
      const plugin = await readPlugin(installConfig.plugins.pluginsDir, pluginId);

      if (plugin) {
        plugins.push(plugin);
      }
    }
  }

  logger.info(
    "Loaded plugins: %o",
    plugins.map((x) => x.id),
  );

  return plugins;
};
