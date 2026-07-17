import { spawn, spawnSync } from "child_process";
import { rmSync, writeFileSync } from "fs";
import { dump } from "js-yaml";
import { constants } from "os";
import { createComposeSpec } from "src/compose";
import { InstallConfigSchema } from "src/config/install";
import { logger } from "src/log";
import { readEnabledPlugins } from "src/plugin";

const forceExitTimeoutMs = 10_000;
const fallbackSignalCodes: Partial<Record<NodeJS.Signals, number>> = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGKILL: 9,
  SIGTERM: 15,
};

const signalToExitCode = (signal: NodeJS.Signals) => 128 + (constants.signals[signal] ?? fallbackSignalCodes[signal] ?? 0);

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
    rmSync(filename, { force: true });
  };

  const terminalSignals: NodeJS.Signals[] = ["SIGINT", "SIGQUIT"];
  const signals: NodeJS.Signals[] = [...terminalSignals, "SIGTERM", "SIGHUP"];
  const signalHandlers: Partial<Record<NodeJS.Signals, () => void>> = {};
  let forceExitTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    const params = ["-f", filename];

    const plugins = await readEnabledPlugins(config);

    for (const plugin of plugins) {
      if (plugin.dockerComposeFilePath) {
        logger.info("Using docker compose config from %s of plugin %s", plugin.dockerComposeFilePath, plugin.id);
        params.push("-f", plugin.dockerComposeFilePath);
      }
    }
    params.push(...args);

    const child = spawn(dockerComposeCommand, params, { shell: true, stdio: "inherit" });

    for (const signal of signals) {
      const handler = () => {
        logger.debug("Received %s. Deleting compose file", signal);
        clean();

        if (!(process.stdin.isTTY && terminalSignals.includes(signal))) {
          child.kill(signal);
        }

        if (!forceExitTimer) {
          forceExitTimer = setTimeout(() => {
            logger.warn("Child process did not exit after receiving %s. Forcing exit.", signal);
            child.kill("SIGKILL");
            process.exit(signalToExitCode(signal));
          }, forceExitTimeoutMs);
          forceExitTimer.unref();
        }
      };

      signalHandlers[signal] = handler;
      process.on(signal, handler);
    }

    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (signal) {
          process.exitCode = signalToExitCode(signal);
        } else if (code) {
          process.exitCode = code;
        }
        resolve();
      });
    });
  } finally {
    if (forceExitTimer) {
      clearTimeout(forceExitTimer);
    }

    for (const signal of signals) {
      const handler = signalHandlers[signal];
      if (handler) {
        process.off(signal, handler);
      }
    }
    logger.debug("Process exited. Deleting compose file");
    clean();
  }
}
