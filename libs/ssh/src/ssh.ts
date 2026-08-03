import type { Logger } from "ts-log";

import { NodeSSH, SSHExecCommandOptions, SSHExecCommandResponse } from "node-ssh";
import { quote } from "shell-quote";

import { KeyPair } from "./key";

export class SshConnectError extends Error {
  constructor(options?: ErrorOptions) {
    super("Error when connecting to remote", options);
  }
}

export async function sshRawConnect(address: string, username: string, rootKeyPair: KeyPair, logger: Logger) {
  const [host, port] = address.split(":");
  const ssh = new NodeSSH();

  await ssh
    .connect({ host, port: port ? +port : undefined, username, privateKey: rootKeyPair.privateKey })
    .catch((e) => {
      logger.info("Login to %s as %s failed.", host, username);
      throw new SshConnectError({ cause: e });
    });

  return ssh;
}

async function sshRawConnectByPassword(address: string, username: string, password: string, logger: Logger) {
  const [host, port] = address.split(":");
  const ssh = new NodeSSH();

  await ssh.connect({ host, port: port ? +port : undefined, username, password: password }).catch((e) => {
    logger.info("Login to %s as %s by password failed.", host, username);
    throw new SshConnectError({ cause: e });
  });

  return ssh;
}

export async function sshConnect<T>(
  address: string,
  username: string,
  rootKeyPair: KeyPair,
  logger: Logger,
  run: (ssh: NodeSSH) => Promise<T>,
) {
  const ssh = await sshRawConnect(address, username, rootKeyPair, logger);

  return run(ssh)
    .catch((e) => {
      if (e.code !== undefined) {
        throw e;
      } else {
        logger.info("Running ssh failed.");
        throw new SshConnectError({ cause: e.message });
      }
    })
    .finally(() => {
      ssh.dispose();
    });
}

export async function sshConnectByPassword<T>(
  address: string,
  username: string,
  password: string,
  logger: Logger,
  run: (ssh: NodeSSH) => Promise<T>,
) {
  const ssh = await sshRawConnectByPassword(address, username, password, logger);

  return run(ssh).finally(() => {
    ssh.dispose();
  });
}

function getEnvPrefix(env: Record<string, string>) {
  return Object.keys(env)
    .map((x) => `${x}=${quote([env[x] ?? ""])} `)
    .join("");
}

function constructCommand(cmd: string, parameters: readonly string[], env?: Record<string, string>) {
  const command = cmd + (parameters.length > 0 ? " " + quote(parameters) : "");

  const envPrefix = env ? getEnvPrefix(env) : "";

  return envPrefix + command;
}

export class SSHExecError extends Error {
  constructor(
    public response: SSHExecCommandResponse,
    options?: ErrorOptions,
  ) {
    super("Error when executing command", options);
  }
}

export async function loggedExec(
  ssh: NodeSSH,
  logger: Logger,
  throwIfFailed: boolean,
  cmd: string,
  parameters: string[],
  options?: SSHExecCommandOptions,
) {
  const env = options?.execOptions?.env as Record<string, string>;

  const filteredParameters = parameters.filter((param) => param !== "");

  const command = constructCommand(cmd, filteredParameters, env);

  const resp = await ssh.execCommand(command, options);
  logger.info("Command execCommand %s, options %o", command, options);

  if (resp.code !== 0) {
    logger.error("Command %o failed. stdout %s, stderr %s", command, resp.stdout, resp.stderr);
    if (throwIfFailed) {
      throw new SSHExecError(resp);
    }
  } else {
    logger.debug("Command %o completed. stdout %s, stderr %s", command, resp.stdout, resp.stderr);
  }
  return resp;
}
