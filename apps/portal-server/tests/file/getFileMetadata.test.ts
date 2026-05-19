import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { sftpStat } from "@scow/lib-ssh";
import { FileServiceClient } from "@scow/protos/build/portal/file";
import { createServer } from "src/app";

import {
  actualPath,
  cluster,
  connectToTestServer,
  createTestItems,
  expectGrpcThrow,
  resetTestServer,
  TestSshServer,
  userId,
} from "./utils";

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

it("gets file size", async () => {
  const reply = await asyncUnaryCall(client, "getFileMetadata", {
    cluster,
    userId,
    path: actualPath("test1"),
  });

  const stat = await sftpStat(ssh.sftp)(actualPath("test1"));

  expect(reply.size).toBe(stat.size);
});

it("returns error if file is not accessible", async () => {
  await expectGrpcThrow(
    asyncUnaryCall(client, "getFileMetadata", {
      cluster,
      userId,
      path: actualPath("test2"),
    }),
    (e) => {
      expect(e.code).toBe(status.PERMISSION_DENIED);
    },
  );
});

it("gets file type", async () => {
  const reply = await asyncUnaryCall(client, "getFileMetadata", {
    cluster,
    userId,
    path: actualPath("test1"),
  });

  expect(reply.type).toBe("file");
});
