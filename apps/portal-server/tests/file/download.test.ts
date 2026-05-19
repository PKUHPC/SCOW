import { asyncReplyStreamCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials, status } from "@grpc/grpc-js";
import { sftpReadFile } from "@scow/lib-ssh";
import { DownloadResponse, FileServiceClient } from "@scow/protos/build/portal/file";
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

async function collectInfo(stream: AsyncIterable<DownloadResponse>) {
  const buffer = [] as Uint8Array[];

  for await (const res of stream) {
    buffer.push(res.chunk);
  }

  return Buffer.concat(buffer);
}

async function expectContentEquals(stream: AsyncIterable<DownloadResponse>, sshFilePath: string) {
  const expected = await sftpReadFile(ssh.sftp)(sshFilePath);

  expect(await collectInfo(stream)).toEqual(expected);
}

it("gets file content", async () => {
  const path = actualPath("test1");

  const stream = asyncReplyStreamCall(client, "download", {
    cluster,
    userId,
    path,
  });

  await expectContentEquals(stream, path);
});

it("can get dotfiles", async () => {
  const path = actualPath(".test1");

  await createFile(ssh.sftp, path);

  const stream = asyncReplyStreamCall(client, "download", {
    cluster,
    userId,
    path,
  });

  await expectContentEquals(stream, path);
});

it("returns error if /getFile a folder", async () => {
  const stream = asyncReplyStreamCall(client, "download", {
    cluster,
    userId,
    path: actualPath("dir1"),
  });

  await expectGrpcThrow(collectInfo(stream), (e) => {
    expect(e.code).toBe(status.INTERNAL);
  });
});

it("returns error if /getFile non-existent file", async () => {
  const stream = asyncReplyStreamCall(client, "download", {
    cluster,
    userId,
    path: actualPath("dir1"),
  });

  await expectGrpcThrow(collectInfo(stream), (e) => {
    expect(e.code).toBe(status.INTERNAL);
  });
});
