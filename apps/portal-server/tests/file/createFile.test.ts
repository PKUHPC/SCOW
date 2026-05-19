import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { sftpExists } from "@scow/lib-ssh";
import { FileServiceClient } from "@scow/protos/build/portal/file";
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

it("creates file", async () => {
  const fileName = "newfile";

  await asyncUnaryCall(client, "createFile", {
    cluster,
    userId,
    path: actualPath(fileName),
  });

  expect(await sftpExists(ssh.sftp, actualPath(fileName))).toBeTrue();
});

it("returns 409 if exists", async () => {
  const fileName = "newfile";
  const filePath = actualPath(fileName);

  await createFile(ssh.sftp, filePath);

  await expectGrpcThrow(
    asyncUnaryCall(client, "createFile", {
      cluster,
      userId,
      path: filePath,
    }),
    (e) => {
      expect(e.code).toBe(status.ALREADY_EXISTS);
    },
  );
});
