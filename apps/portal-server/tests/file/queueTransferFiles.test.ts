import { asyncRequestStreamCall, asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { credentials } from "@grpc/grpc-js";
import { sftpExists, sftpMkdir, sftpRmdir, sftpUnlink } from "@scow/lib-ssh";
import { FileServiceClient, TransferInfo } from "@scow/protos/build/portal/file";
import path from "path";
import { createServer } from "src/app";
import {
  cluster,
  connectToTestServer,
  createTestItems,
  resetTestServer,
  TestSshServer,
  userId,
} from "tests/file/utils";

let ssh: TestSshServer;
let server: Server;
let client: FileServiceClient;

// 用于测试的目录和文件
let testTransferDir: string = "";
let testTransferFile: string = "";

// 写入文件的内容
const toCluster = "123.123.123.123";
const fatherPath = "/transfer_dir";
const fileName = "transfer_file";
const transferSize = "1,048,576";
const progress = "42%";
const speed = "1.74KB/s";
const leftTime = "0:00:33";

// queryFileTransfer应该返回的结果
const filePath = path.join(fatherPath, fileName);
const transferSizeKb = 1024;
const progressInt = 42;
const speedKBps = 1.74;
const leftTimeSeconds = 33;

const content =
  toCluster +
  " " +
  fatherPath +
  "\n" +
  fileName +
  "\n" +
  "\r" +
  transferSize +
  " " +
  progress +
  " " +
  speed +
  " " +
  leftTime;

beforeEach(async () => {
  ssh = await connectToTestServer();
  await createTestItems(ssh);

  server = await createServer();
  await server.start();

  client = new FileServiceClient(server.serverAddress, credentials.createInsecure());

  // 上传测试文件，用于scow-sync-query读取
  const HomePath = await asyncUnaryCall(client, "getHomeDirectory", {
    cluster,
    userId,
  });
  const scowPath = `${HomePath.path}/scow`;
  const scowSyncPath = path.join(scowPath, ".scow-sync");
  testTransferDir = path.join(scowSyncPath, "test");
  testTransferFile = path.join(testTransferDir, "test1.out");

  const scowExist = await sftpExists(ssh.sftp, scowPath);

  if (!scowExist) {
    await sftpMkdir(ssh.sftp)(scowPath);
  }

  const scowSyncExist = await sftpExists(ssh.sftp, scowSyncPath);
  if (!scowSyncExist) {
    await sftpMkdir(ssh.sftp)(scowSyncPath);
  }

  await sftpMkdir(ssh.sftp)(testTransferDir);

  await asyncRequestStreamCall(client, "upload", async ({ writeAsync }) => {
    await writeAsync({ message: { $case: "info", info: { cluster, path: testTransferFile, userId } } });
    await writeAsync({ message: { $case: "chunk", chunk: Uint8Array.from(Buffer.from(content)) } });
  });
});

afterEach(async () => {
  // 删去用于测试的目录和文件
  await sftpUnlink(ssh.sftp)(testTransferFile);
  await sftpRmdir(ssh.sftp)(testTransferDir);

  await resetTestServer(ssh);
  await server.close();
});

it.skip("query the transfer information of scow-sync", async () => {
  const result = await asyncUnaryCall(client, "queryFileTransfer", {
    cluster,
    userId,
  });

  expect(result.transferInfos.length).toBe(1);
  const transferInfo: TransferInfo = result.transferInfos[0];

  expect(transferInfo.toCluster).toBe(toCluster);
  expect(transferInfo.filePath).toBe(filePath);
  expect(transferInfo.transferSizeKb).toBe(transferSizeKb);
  expect(transferInfo.progress).toBe(progressInt);
  expect(transferInfo.speedKBps).toBe(speedKBps);
  expect(transferInfo.remainingTimeSeconds).toBe(leftTimeSeconds);
});
