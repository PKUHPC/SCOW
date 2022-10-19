import { ServiceError } from "@grpc/grpc-js";
import { sftpWriteFile, sshRawConnect, sshRmrf } from "@scow/lib-ssh";
import { randomBytes } from "crypto";
import FormData from "form-data";
import { NodeSSH } from "node-ssh";
import path from "path";
import pino from "pino";
import { rootKeyPair } from "src/config/env";
import { SFTPWrapper } from "ssh2";

const target = "localhost:22222";
export const userId = "test";
export const cluster = "hpc01";

export interface TestSshServer {
  ssh: NodeSSH;
  sftp: SFTPWrapper;
}

export const connectToTestServer = async () => {

  const ssh = await sshRawConnect(target, userId, rootKeyPair, pino());

  return { ssh, sftp: await ssh.requestSFTP() } as TestSshServer;
};

export const resetTestServer = async (server: TestSshServer) => {
  const base = baseFolder();

  await sshRmrf(server.ssh, path.dirname(base));
  server.ssh.dispose();
};

export async function createFile(sftp: SFTPWrapper, filePath: string) {
  await sftpWriteFile(sftp)(filePath, randomBytes(10));
}

const baseFolder = () => `tests/testFolder${process.env.JEST_WORKER_ID}/${userId}`;

export function actualPath(filename: string) {
  return path.join(baseFolder(), filename);
}

// returns base folder
export async function createTestItems({ sftp, ssh }: TestSshServer): Promise<string> {
  const base = baseFolder();
  await ssh.mkdir(path.join(base, "dir1"), undefined, sftp);
  const test1 = path.join(base, "test1");
  await createFile(sftp, test1);

  return base;
}

export function mockFileForm(size: number, filename: string) {
  const formData = new FormData();

  formData.append("file", Buffer.alloc(size, 1), {
    filename,
    contentType: "application/pdf",
    knownLength: size,
  });
  return formData;
}

export async function expectGrpcThrow(promise: Promise<unknown>, expectError: (error: ServiceError) => void) {
  await promise.then(() => expect("").fail("Promise resolved"), expectError);
}
