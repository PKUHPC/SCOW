import { generateKeyPair, randomBytes } from "crypto";
import { NodeSSH } from "node-ssh";
import { homedir } from "os";
import { dirname, join } from "path";
import { getKeyPair, KeyPair } from "src/key";
import { sftpWriteFile } from "src/sftp";
import { sshRawConnect, sshRmrf } from "src/ssh";
import { SFTPWrapper } from "ssh2";

export const target = "localhost:22222";
export const rootUserId = "root";
export const testUserId = "test";
export const testUserPassword = "test";

export interface TestSshServer {
  ssh: NodeSSH;
  sftp: SFTPWrapper;
}

const SSH_PRIVATE_KEY_PATH = join(homedir(), ".ssh", "id_rsa");
const SSH_PUBLIC_KEY_PATH = join(homedir(), ".ssh", "id_rsa.pub");

export const rootKeyPair = getKeyPair(SSH_PRIVATE_KEY_PATH, SSH_PUBLIC_KEY_PATH);

export const connectToTestServerAsRoot = async () => {
  const ssh = await sshRawConnect(target, rootUserId, rootKeyPair, console);

  return { ssh, sftp: await ssh.requestSFTP() } as TestSshServer;
};

export const resetTestServerAsRoot = async (server: TestSshServer) => {
  const base = baseFolder();

  await sshRmrf(server.ssh, dirname(base));
  server.ssh.dispose();
};

export async function createFile(sftp: SFTPWrapper, filePath: string) {
  await sftpWriteFile(sftp)(filePath, randomBytes(10));
}

const baseFolder = () => `tests/testFolder${process.env.JEST_WORKER_ID}/${rootUserId}`;

// returns base folder
export async function createTestItems({ sftp, ssh }: TestSshServer): Promise<string> {
  const base = baseFolder();
  await ssh.mkdir(join(base, "dir1"), undefined, sftp);
  const test1 = join(base, "test1");
  await createFile(sftp, test1);

  return base;
}

export async function generateSshKeyPair() {
  return new Promise<KeyPair>((res, rej) => {
    generateKeyPair(
      "rsa",
      {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
          cipher: "aes-256-cbc",
          passphrase: "",
        },
      },
      (err, publicKey, privateKey) => {
        // Handle errors and use the generated key pair.
        if (err) {
          rej(err);
        }

        res({ publicKey, privateKey });
      },
    );
  });
}
