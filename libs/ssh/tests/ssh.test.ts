import { NodeSSH } from "node-ssh";
import { SftpError } from "src/sftp";
import { executeAsUser, getEnvPrefix, getUserHomedir, sshConnectByPassword, sshRmrf } from "src/ssh";
import {
  connectToTestServerAsRoot,
  resetTestServerAsRoot,
  rootUserId,
  target,
  TestSshServer,
  testUserId,
  testUserPassword,
} from "tests/utils";

let testServer: TestSshServer;

beforeEach(async () => {
  testServer = await connectToTestServerAsRoot();
});

afterEach(async () => {
  await resetTestServerAsRoot(testServer);
});

it.each([
  [["whoami", [], {}], testUserId],
  [["echo", ["$USER"], {}], testUserId],
  [["echo", ["$USER $TEST", "$TEST"], { TEST: "1" }], `${testUserId} 1 1`],
] as const)("execute command as another user", async ([cmd, parameters, env], stdout) => {
  const resp = await executeAsUser(testServer.ssh, testUserId, console, false, cmd, parameters, {
    execOptions: { env },
  });

  expect(resp.stdout).toBe(stdout);
});

it.each([
  [{ test: "1" }, "test=1 "],
  [{ test: "1", test2: "2" }, "test=1 test2=2 "],
  [{ test: "1", test2: '2"' }, "test=1 test2='2\"' "],
])("gets correct env prefix", async (env, expected) => {
  expect(getEnvPrefix(env)).toBe(expected);
});

it.each([
  [rootUserId, "/root"],
  [testUserId, "/home/test"],
])("get the homedir of user %p to %p", async (user, expected) => {
  expect(await getUserHomedir(testServer.ssh, user, console)).toBe(expected);
  await sshConnectByPassword(target, testUserId, testUserPassword, console, async (ssh) => {
    expect(await getUserHomedir(ssh, user, console)).toBe(expected);
  });
});

it("sshRmrf should catches error and throws SSHExecError", async () => {
  const filePath = "/data/home/test";
  const ssh = new NodeSSH();
  try {
    await sshRmrf(ssh, filePath);
    expect("").fail("should not reach here");
  } catch (e) {
    expect(e).toBeInstanceOf(SftpError);
  }
});
