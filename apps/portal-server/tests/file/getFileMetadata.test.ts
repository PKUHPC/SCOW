import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { createServer } from "src/app";
import { FileServiceClient } from "src/generated/portal/file";

import { actualPath, cluster, connectToTestServer, 
  createTestItems, expectGrpcThrow, resetTestServer, TestSshServer, userId } from "./utils";

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

it("gets file metadata", async () => {

  const reply = await asyncUnaryCall(client, "getFileMetadata", {
    cluster, userId, path: actualPath("test1"),
  });

  expect(reply.size).toEqual(expect.any(Number));
});

it("returns error if file is not accessible", async () => {
  await expectGrpcThrow(asyncUnaryCall(client, "getFileMetadata", {
    cluster, userId, path: actualPath("test2"),
  }), (e) => {
    expect(e.code).toBe(status.PERMISSION_DENIED);
  });
});