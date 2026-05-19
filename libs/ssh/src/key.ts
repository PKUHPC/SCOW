import type { Logger } from "ts-log";

import fs from "fs";
import { join } from "path";

import { sftpAppendFile, sftpChmod, sftpChown, sftpMkdir, sftpStatOrUndefined, sftpWriteFile } from "./sftp";
import { getUserHomedir, sshConnect, sshConnectByPassword } from "./ssh";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export function getKeyPair(privateKeyPath: string, publicKeyPath: string): KeyPair {
  return {
    privateKey: fs.readFileSync(privateKeyPath, "utf-8").trim(),
    publicKey: fs.readFileSync(publicKeyPath, "utf-8").trim(),
  };
}

/**
 * Insert the host's public key to the user's authorized_keys to enable public key login
 *
 * @param user the user
 * @param host the host of machine
 * @param rootKeyPair the key pair of root
 * @param logger the logger
 */
export async function insertKeyAsRoot(user: string, host: string, rootKeyPair: KeyPair, logger: Logger) {
  // https://superuser.com/a/484280
  logger.info("Adding key to user %s to %s", user, host);

  await sshConnect(host, "root", rootKeyPair, logger, async (ssh) => {
    const homeDir = await ssh.execCommand(`eval echo ~${user}`);
    const userID = await ssh.execCommand(`id -u ${user}`);
    const userGID = await ssh.execCommand(`id -g ${user}`);

    const uid = Number(userID.stdout.trim());
    const gid = Number(userGID.stdout.trim());

    const userHomeDir = homeDir.stdout.trim();

    const sftp = await ssh.requestSFTP();

    // make sure user home directory exists.
    await ssh.mkdir(userHomeDir, undefined, sftp);
    await sftpChmod(sftp)(userHomeDir, "740");
    // root create the directory, so we need to change the owner
    await sftpChown(sftp)(userHomeDir, uid, gid);

    // make sure .ssh dir exists
    const sshDir = join(userHomeDir, ".ssh");
    const sshDirStat = await sftpStatOrUndefined(sftp)(sshDir);
    if (!sshDirStat) {
      logger.info("%s not exists in %s user %s. Creating it.", sshDir, host, user);
      await ssh.mkdir(sshDir, undefined, sftp);
      await sftpChmod(sftp)(sshDir, "700");
      await sftpChown(sftp)(sshDir, uid, gid);
    }

    // insert key
    const keyFilePath = join(sshDir, "authorized_keys");
    const keyFileStat = await sftpStatOrUndefined(sftp)(keyFilePath);
    if (!keyFileStat) {
      logger.info("Writing key to user %s, userID %s to %s in file %s", user, uid, host, keyFilePath);
      await sftpWriteFile(sftp)(keyFilePath, rootKeyPair.publicKey + "\n");
      await sftpChmod(sftp)(keyFilePath, "644");
      await sftpChown(sftp)(keyFilePath, uid, gid);
    } else {
      logger.info("%s exists for user %s in %s. Appending public key", keyFilePath, user, host);
      await sftpAppendFile(sftp)(keyFilePath, "\n" + rootKeyPair.publicKey + "\n");
    }
  });
}

/**
 * Login as user by password and insert the host's public key to the user's authorized_keys to enable public key login
 *
 * @param address the address
 * @param username the username
 * @param password password
 * @param rootKeyPair key pair
 * @param logger logger
 */
export async function insertKeyAsUser(
  address: string,
  username: string,
  password: string,
  rootKeyPair: KeyPair,
  logger: Logger,
) {
  await sshConnectByPassword(address, username, password, logger, async (ssh) => {
    const userHomeDir = await getUserHomedir(ssh, username, logger);

    const sftp = await ssh.requestSFTP();
    const stat = await sftpStatOrUndefined(sftp)(userHomeDir);

    if (!stat) {
      logger.warn(
        "Home directory %s of user %s doesn't exist even after login as the user. Insert key as root.",
        userHomeDir,
        username,
      );

      await insertKeyAsRoot(username, address, rootKeyPair, logger);
      return;
    }

    // make sure user home dir is a directory
    if (!stat.isDirectory()) {
      throw new Error(`${userHomeDir} of user ${username} exists but is not a directory`);
    }

    // make sure ~/.ssh exists and has correct permission
    const sshDir = join(userHomeDir, ".ssh");
    const sshDirStat = await sftpStatOrUndefined(sftp)(sshDir);
    if (!sshDirStat) {
      logger.info("%s not exists in %s user %s. Creating it.", sshDir, address, username);
      await sftpMkdir(sftp)(sshDir);
      await sftpChmod(sftp)(sshDir, "700");
    }

    // check if authorized_keys exists
    const keyFilePath = join(sshDir, "authorized_keys");
    const authorizedKeysStat = await sftpStatOrUndefined(sftp)(keyFilePath);
    if (!authorizedKeysStat) {
      logger.info(
        "%s not exists in %s for user %s. Create the file and insert public key",
        keyFilePath,
        address,
        username,
      );
      await sftpWriteFile(sftp)(keyFilePath, rootKeyPair.publicKey + "\n");
      await sftpChmod(sftp)(keyFilePath, "644");
    } else {
      logger.info("%s exists in %s for user %s. Insert public key", keyFilePath, address, username);
      await sftpAppendFile(sftp)(keyFilePath, "\n" + rootKeyPair.publicKey + "\n");
    }
  });
}
