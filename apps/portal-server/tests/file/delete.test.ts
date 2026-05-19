import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials } from "@grpc/grpc-js";
import { sftpExists, sftpMkdir } from "@scow/lib-ssh";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import path from "path";
import { createServer } from "src/app";
import {
  actualPath,
  cluster,
  connectToTestServer,
  createFile,
  createTestItems,
  resetTestServer,
  TestSshServer,
  userId,
} from "tests/file/utils";

let ssh: TestSshServer;
let server: Server;
let client: FileServiceClient;

beforeEach(async () => {
  ssh = await connectToTestServer();
  await createTestItems(ssh);

  server = await createServer();
  await server.start();

  client = new FileServiceClient(server.serverAddress, credentials.createInsecure());
});

afterEach(async () => {
  await resetTestServer(ssh);
  await server.close();
});

it("deletes file", async () => {
  const fileName = "testfile";

  await createFile(ssh.sftp, actualPath(fileName));

  await asyncUnaryCall(client, "deleteFile", {
    cluster,
    userId,
    path: actualPath(fileName),
  });

  expect(await sftpExists(ssh.sftp, actualPath(fileName))).toBeFalse();
});

it("deletes folder", async () => {
  const fileName = "testfile";
  const folderName = "folder" + process.env.JEST_WORKER_ID;

  const folderFullPath = actualPath(folderName);

  await sftpMkdir(ssh.sftp)(folderFullPath);
  await createFile(ssh.sftp, actualPath(path.join(folderName, fileName)));

  await asyncUnaryCall(client, "deleteDirectory", {
    cluster,
    userId,
    path: folderFullPath,
  });

  expect(await sftpExists(ssh.sftp, folderFullPath)).toBeFalse();
});

it("passes if deleting non-existence folder", async () => {
  await asyncUnaryCall(client, "deleteDirectory", {
    cluster,
    userId,
    path: actualPath("non-exists"),
  });
});
