import { join } from "path";
import { insertKeyAsRoot, insertKeyAsUser, KeyPair } from "src/key";
import {
  createDirectoriesRecursively,
  sftpChmod,
  sftpChown,
  sftpExists,
  sftpReadFile,
  sftpStat,
  sftpWriteFile,
} from "src/sftp";
import { sshConnect, sshRmrf } from "src/ssh";

import {
  connectToTestServerAsRoot,
  createTestItems,
  generateSshKeyPair,
  resetTestServerAsRoot,
  rootKeyPair,
  target,
  TestSshServer,
} from "./utils";

let serverSsh: TestSshServer;
const randomPostfix = String(Math.ceil(Math.random() * 1000 + 1));
const testUser = "testNewUser" + randomPostfix;
const home = join("/testNewUserHome", testUser);
const sshDir = join(home, ".ssh");
const keyFile = join(sshDir, "authorized_keys");
const password = "12345678";

beforeEach(async () => {
  serverSsh = await connectToTestServerAsRoot();
  await createTestItems(serverSsh);
  // create user
  await serverSsh.ssh.execCommand(`adduser -D -h ${home} ${testUser}`);
  await serverSsh.ssh.execCommand(`echo ${testUser}:${password}|chpasswd`);
});

afterEach(async () => {
  // delete the new user we created, and delete the home directory
  await serverSsh.ssh.execCommand(`deluser ${testUser}`);
  await sshRmrf(serverSsh.ssh, home);

  await resetTestServerAsRoot(serverSsh);
});

function tryLoginAsUser() {
  return sshConnect(target, testUser, rootKeyPair, console, async () => undefined);
}

it("insert key as root", async () => {
  await insertKeyAsRoot(testUser, target, rootKeyPair, console);

  expect(await sftpExists(serverSsh.sftp, home)).toBeTrue();

  expect(await sftpExists(serverSsh.sftp, sshDir)).toBeTrue();
  expect(await sftpExists(serverSsh.sftp, keyFile)).toBeTrue();

  await tryLoginAsUser();

  // check ssh key info
  const keyContent = (await sftpReadFile(serverSsh.sftp)(keyFile)).toString();
  expect(keyContent).toMatch(rootKeyPair.publicKey);

  // check ssh key permission and owner
  const userID = await serverSsh.ssh.execCommand(`id -u ${testUser}`);
  const userGID = await serverSsh.ssh.execCommand(`id -g ${testUser}`);

  const uid = Number(userID.stdout.trim());
  const gid = Number(userGID.stdout.trim());

  const keyStats = await sftpStat(serverSsh.sftp)(keyFile);
  const keyPermission = (keyStats.mode & parseInt("777", 8)).toString(8);
  expect(keyPermission).toEqual("644");
  expect(keyStats.uid).toBe(uid);
  expect(keyStats.gid).toBe(gid);

  const sshStats = await sftpStat(serverSsh.sftp)(sshDir);
  const sshPermission = (sshStats.mode & parseInt("777", 8)).toString(8);
  expect(sshPermission).toEqual("700");
  expect(sshStats.uid).toBe(uid);
  expect(sshStats.gid).toBe(gid);
});

it("insert keys as user", async () => {
  await insertKeyAsUser(target, testUser, password, rootKeyPair, console);

  expect(await sftpExists(serverSsh.sftp, home)).toBeTrue();

  expect(await sftpExists(serverSsh.sftp, sshDir)).toBeTrue();
  expect(await sftpExists(serverSsh.sftp, keyFile)).toBeTrue();

  await tryLoginAsUser();
});

describe("doesn't override authorized_keys if exists", () => {
  let existingKey: KeyPair;

  beforeEach(async () => {
    existingKey = await generateSshKeyPair();

    const userUID = Number((await serverSsh.ssh.execCommand(`id -g ${testUser}`)).stdout);
    const userGID = Number((await serverSsh.ssh.execCommand(`id -u ${testUser}`)).stdout);

    await createDirectoriesRecursively(serverSsh.sftp, sshDir);
    await sftpChown(serverSsh.sftp)(sshDir, userUID, userGID);
    await sftpWriteFile(serverSsh.sftp)(keyFile, existingKey.publicKey);
    await sftpChown(serverSsh.sftp)(keyFile, userUID, userGID);
    await sftpChmod(serverSsh.sftp)(keyFile, "644");
  });

  const checkExistingKeys = async () => {
    const keyContent = (await sftpReadFile(serverSsh.sftp)(keyFile)).toString();
    expect(keyContent).toInclude(existingKey.publicKey);
  };

  it("as user", async () => {
    await insertKeyAsUser(target, testUser, password, rootKeyPair, console);
    await tryLoginAsUser();

    await checkExistingKeys();
  });

  it.only("as root", async () => {
    await insertKeyAsRoot(testUser, target, rootKeyPair, console);
    await tryLoginAsUser();
    await checkExistingKeys();
  });
});
