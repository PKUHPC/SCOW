import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials } from "@grpc/grpc-js";
import { ExistsRequest, FileServiceClient } from "@scow/protos/build/portal/file";
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

it("return true if exists", async () => {
  const fileName = "file1";
  const filePath = actualPath(fileName);

  await createFile(ssh.sftp, filePath);

  const result = await asyncUnaryCall(client, "exists", {
    cluster,
    userId,
    path: filePath,
  } as ExistsRequest);

  expect(result.exists).toBeTrue();
});

it("return false if not exists", async () => {
  const fileName = "file2";
  const filePath = actualPath(fileName);

  const result = await asyncUnaryCall(client, "exists", {
    cluster,
    userId,
    path: filePath,
  } as ExistsRequest);

  expect(result.exists).toBeFalse();
});
