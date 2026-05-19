import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { sftpExists, sftpMkdir } from "@scow/lib-ssh";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { join } from "path";
import { createServer } from "src/app";
import {
  actualPath,
  cluster,
  connectToTestServer,
  createFile,
  createTestItems,
  expectGrpcThrow,
  resetTestServer,
  TestSshServer,
  userId,
} from "tests/file/utils";

let ssh: TestSshServer;
let server: Server;
let client: FileServiceClient;

const fileName = "testfile";

beforeEach(async () => {
  ssh = await connectToTestServer();
  await createTestItems(ssh);

  await createFile(ssh.sftp, actualPath(fileName));

  server = await createServer();
  await server.start();

  client = new FileServiceClient(server.serverAddress, credentials.createInsecure());
});

afterEach(async () => {
  await resetTestServer(ssh);
  await server.close();
});

it("moves file", async () => {
  const newFileName = "newFile";

  await asyncUnaryCall(client, "move", {
    cluster,
    userId,
    fromPath: actualPath(fileName),
    toPath: actualPath(newFileName),
  });

  expect(await sftpExists(ssh.sftp, actualPath(fileName))).toBeFalse();
  expect(await sftpExists(ssh.sftp, actualPath(newFileName))).toBeTrue();
});

it("returns error if target dir contains a dir with the same name as the original file", async () => {
  const sourceFolder = "newFolder";
  const containingFile = "testfile";
  const targetFolder = "targetFolder";

  await sftpMkdir(ssh.sftp)(actualPath(sourceFolder));
  await createFile(ssh.sftp, actualPath(join(sourceFolder, containingFile)));
  await sftpMkdir(ssh.sftp)(actualPath(targetFolder));
  await sftpMkdir(ssh.sftp)(actualPath(join(targetFolder, containingFile)));

  await expectGrpcThrow(
    asyncUnaryCall(client, "move", {
      cluster,
      userId,
      fromPath: actualPath(actualPath(join(sourceFolder, containingFile))),
      toPath: actualPath(targetFolder),
    }),
    (e) => {
      expect(e.code).toBe(status.INTERNAL);
    },
  );
});
