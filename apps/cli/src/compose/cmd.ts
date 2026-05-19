import { spawnSync } from "child_process";
import onDeath from "death";
import { unlinkSync, writeFileSync } from "fs";
import { dump } from "js-yaml";
import { createComposeSpec } from "src/compose";
import { InstallConfigSchema } from "src/config/install";
import { logger } from "src/log";
import { readEnabledPlugins } from "src/plugin";

export function getAvailableDockerComposeCommand() {
  // check if docker compose is available
  const r1 = spawnSync("docker", ["compose", "version"], { stdio: "pipe" });
  if (!r1.error && r1.status === 0) {
    return "docker compose";
  }

  // check if docker-compose is available
  const r2 = spawnSync("docker-compose", ["version"], { stdio: "pipe" });
  if (!r2.error && r2.status === 0) {
    return "docker-compose";
  }

  throw new Error("docker compose is not available, please install docker compose first.");
}

export async function runComposeCommand(config: InstallConfigSchema, args: string[]) {
  const dockerComposeCommand = getAvailableDockerComposeCommand();

  logger.debug("Using %s to run docker compose commands", dockerComposeCommand);

  const composeConfig = createComposeSpec(config);

  const filename = `docker-compose-${Date.now()}.yml`;

  writeFileSync(filename, dump(composeConfig), { encoding: "utf-8" });
  logger.debug("Generated " + filename);

  const clean = () => {
    unlinkSync(filename);
  };

  onDeath((arg) => {
    logger.debug("Received %s. Deleting compose file", arg);
    clean();
  });

  const params = ["-f", filename];

  const plugins = await readEnabledPlugins(config);

  for (const plugin of plugins) {
    if (plugin.dockerComposeFilePath) {
      logger.info("Using docker compose config from %s of plugin %s", plugin.dockerComposeFilePath, plugin.id);
      params.push("-f", plugin.dockerComposeFilePath);
    }
  }
  params.push(...args);

  try {
    spawnSync(dockerComposeCommand, params, { shell: true, stdio: "inherit" });
  } finally {
    logger.debug("Process exited. Deleting compose file");
    clean();
  }
}
