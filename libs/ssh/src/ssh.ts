import type { Logger } from "ts-log";

import { NodeSSH, SSHExecCommandOptions, SSHExecCommandResponse } from "node-ssh";
import { quote } from "shell-quote";

import { insertKeyAsRoot, KeyPair } from "./key";
import { SftpError } from "./sftp";

export class SshConnectError extends Error {
  constructor(options?: ErrorOptions) {
    super("Error when connecting to remote", options);
  }
}

/**
 * Connect to SSH and returns the SSH Object
 * Must dispose of the object after use
 *
 * If the username is not root and first login attempt failed,
 * it inserts the public key into the user's authorized_key and logs in again
 *
 * @param address address
 * @param username  username
 * @param rootKeyPair the ssh key pair of root user
 * @param logger logger
 * @returns SSH Object
 */
export async function sshRawConnect(address: string, username: string, rootKeyPair: KeyPair, logger: Logger) {
  const [host, port] = address.split(":");
  const ssh = new NodeSSH();

  async function connect() {
    await ssh.connect({ host, port: port ? +port : undefined, username, privateKey: rootKeyPair.privateKey });
  }

  try {
    await connect();
  } catch (e) {
    if (username === "root") {
      logger.info("Login to %s as %s failed.", host, username);
      throw e;
    }

    logger.info("Login to %s as %s failed. Try inserting public key", host, username);
    await insertKeyAsRoot(username, address, rootKeyPair, logger);
    await connect().catch((e) => {
      logger.error(e, "Login to %s as %s still failed after inserting key", host, username);
      throw new SshConnectError({ cause: e });
    });
  }

  return ssh;
}

/**
 * Connect to SSH by password and returns the SSH Object
 * Must dispose of the object after use
 *
 * @param address address
 * @param username  username
 * @param password password of the user
 * @param logger logger
 * @returns SSH Object
 */
export async function sshRawConnectByPassword(address: string, username: string, password: string, logger: Logger) {
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
      // 若在run回调函数中有具体抛错，直接抛出
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

/**
 * Calculate env prefix. Needed quotes in values are added
 * e.g. { test: "123"; test1: "4\"56" } => "test=123 test1='4\"56' "
 *
 * @param env env objec
 * @returns string to be added in front of the command
 */
export function getEnvPrefix(env: Record<string, string>) {
  return Object.keys(env)
    .map((x) => `${x}=${quote([env[x] ?? ""])} `)
    .join("");
}

/**
 * Construct a command with env prefixes.
 * Some OpenSSH servers don't accept envs
 * This is a workaround by combining the envs to the command
 * @param cmd the command
 * @param parameters the command parameters
 * @param env env
 * @returns command with env prefixes
 */
export function constructCommand(cmd: string, parameters: readonly string[], env?: Record<string, string>) {
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

/**
 *  注意: parameters 中的空字符串参数会在 SSH 参数构造前被过滤掉以防止 SSH 命令格式错误
 *  如果后期出现需要单独向 SSH 参数中传递空字符串的形式，需要进行兼容性修改
 */
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

/**
 * Execute a command as a user
 *
 * @param ssh ssh object connected as root
 * @param user the user the command will execute as
 * @param logger logger
 * @param throwIfFailed throw if failed
 * @param command the command
 * @param parameters the parameters
 * @param options exec options
 */
export async function executeAsUser(
  ssh: NodeSSH,
  user: string,
  logger: Logger,
  throwIfFailed: boolean,
  command: string,
  parameters: readonly string[],
  options?: SSHExecCommandOptions,
) {
  const env = options?.execOptions?.env;
  const envOption = env ? `--preserve-env=${Object.keys(env).join(",")}` : "";

  return await loggedExec(
    ssh,
    logger,
    throwIfFailed,
    "sudo",
    [envOption, "-u", user, "-s", command, ...parameters],
    options,
  );
}

/**
 * Check if the root user can log in to the host
 * If fails, return the error
 *
 * @param host the host
 * @param keyPair key pair
 * @param logger logger
 * @returns the error if login failed
 */
export async function testRootUserSshLogin(host: string, keyPair: KeyPair, logger: Logger) {
  return await sshConnect(host, "root", keyPair, logger, async () => undefined).catch((e) => e);
}

/**
 * Get a user's home directory
 * @param ssh ssh object connected as any user
 * @param username the username to be queried
 * @param logger logger
 * @returns the user's home directory
 */
export const getUserHomedir = async (ssh: NodeSSH, username: string, logger: Logger) => {
  const resp = await loggedExec(ssh, logger, true, "eval", ["echo", `~${username}`]);

  return resp.stdout.trim();
};

export async function sshRmrf(ssh: NodeSSH, path: string) {
  await ssh.exec("rm", ["-rf", path]).catch((e) => {
    // rm -rf 并非sftp命令，属于Linux命令，但其操作的是文件夹，且报错形式与sftp报错一致，故使用SftpError
    throw new SftpError(e);
  });
}
