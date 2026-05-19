import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { dayjsToDateMessage } from "@scow/lib-server/build/date";
import { StatisticServiceClient } from "@scow/protos/build/audit/statistic";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { createServer } from "src/app";
import { OperationLog, OperationResult } from "src/entities/OperationLog";
import { dropDatabase } from "tests/utils/helpers";

dayjs.extend(utc);

let server: Server;
let client: StatisticServiceClient;

const operationLog = {
  operatorUserId: "testUserId",
  operatorIp: "127.0.0.1",
  operationResult: OperationResult.SUCCESS,
  operationEvent: {
    $case: "submitJob" as const,
    submitJob: {
      accountName: "testAccount",
      jobId: 123,
      clusterId: "test",
    },
  },
};

beforeEach(async () => {
  server = await createServer();
  await server.start();
  client = new StatisticServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("get active user count correctly in UTC+8 timezone", async () => {
  const em = server.ext.orm.em.fork();

  const now = dayjs();

  const logs = new Array(10).fill(null).map(
    (_, index) =>
      new OperationLog({
        operatorUserId: `user-${index}`,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: now.toDate(),
        metaData: { $case: "login" as const, login: {} },
      }),
  );

  await em.persistAndFlush(logs);

  const today = now.startOf("day");
  const endDay = now.endOf("day");

  const resp = await asyncClientCall(client, "getActiveUserCount", {
    startTime: today.toISOString(),
    endTime: endDay.toISOString(),
    timeZone: "Asia/Shanghai",
  });

  const nowInUtcPlus8 = now.utcOffset(8);

  expect(resp.results).toMatchObject([
    {
      date: dayjsToDateMessage(nowInUtcPlus8),
      count: 10,
    },
  ]);
});

it("get portal usage count correctly", async () => {
  const em = server.ext.orm.em.fork();

  const submitJobLogs = Array.from(
    { length: 10 },
    () =>
      new OperationLog({
        operatorUserId: operationLog.operatorUserId,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: new Date(),
        metaData: {
          $case: "submitJob" as const,
          submitJob: {
            accountName: "testAccount",
            jobId: 123,
            clusterId: "test",
          },
        },
      }),
  );

  const endJobLogs = Array.from(
    { length: 20 },
    () =>
      new OperationLog({
        operatorUserId: operationLog.operatorUserId,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: new Date(),
        metaData: { $case: "endJob" as const, endJob: { jobId: 123, clusterId: "test" } },
      }),
  );

  const shellLoginLogs = Array.from(
    { length: 30 },
    () =>
      new OperationLog({
        operatorUserId: operationLog.operatorUserId,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: new Date(),
        metaData: {
          $case: "shellLogin" as const,
          shellLogin: { clusterId: "test-cluster", loginNode: "test login node" },
        },
      }),
  );

  const logs = [...submitJobLogs, ...endJobLogs, ...shellLoginLogs];
  await em.persistAndFlush(logs);

  const today = dayjs().startOf("day");
  const endDay = dayjs().endOf("day");

  const resp = await asyncClientCall(client, "getPortalUsageCount", {
    startTime: today.toISOString(),
    endTime: endDay.toISOString(),
  });

  expect(resp.results).toMatchObject([
    {
      operationType: "shellLogin",
      count: 30,
    },
    {
      operationType: "endJob",
      count: 20,
    },
    {
      operationType: "submitJob",
      count: 10,
    },
  ]);
});

it("get mis usage count correctly", async () => {
  const em = server.ext.orm.em.fork();

  const blockUserLogs = Array.from(
    { length: 10 },
    () =>
      new OperationLog({
        operatorUserId: operationLog.operatorUserId,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: new Date(),
        metaData: { $case: "blockUser" as const, blockUser: { accountName: "testAccount", userId: "testUser" } },
      }),
  );

  const unblockUserLogs = Array.from(
    { length: 20 },
    () =>
      new OperationLog({
        operatorUserId: operationLog.operatorUserId,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: new Date(),
        metaData: { $case: "unblockUser" as const, unblockUser: { accountName: "testAccount", userId: "testUser" } },
      }),
  );

  const blockAccountLogs = Array.from(
    { length: 30 },
    () =>
      new OperationLog({
        operatorUserId: operationLog.operatorUserId,
        operatorIp: operationLog.operatorIp,
        operationResult: operationLog.operationResult,
        operationTime: new Date(),
        metaData: {
          $case: "blockAccount" as const,
          blockAccount: { accountName: "testAccount", tenantName: "testTenant", userId: "testUser" },
        },
      }),
  );

  const logs = [...blockUserLogs, ...unblockUserLogs, ...blockAccountLogs];
  await em.persistAndFlush(logs);

  const today = dayjs().startOf("day");
  const endDay = dayjs().endOf("day");

  const resp = await asyncClientCall(client, "getMisUsageCount", {
    startTime: today.toISOString(),
    endTime: endDay.toISOString(),
  });

  expect(resp.results).toMatchObject([
    {
      operationType: "blockAccount",
      count: 30,
    },
    {
      operationType: "unblockUser",
      count: 20,
    },
    {
      operationType: "blockUser",
      count: 10,
    },
  ]);
});
