import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { createServer } from "src/app";
import { updateBlockStatusInSlurm } from "src/bl/block";
import { misConfig } from "src/config/mis";
import { SystemState } from "src/entities/SystemState";
import { BlockedData, insertBlockedData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let data: BlockedData;

beforeEach(async () => {
  server = await createServer();

  const em = server.ext.orm.em.fork();

  data = await insertBlockedData(em);

  await server.start();
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

// Test server will not sync block status at startup
it.skip("test whether the block update time exists at startup", async () => {
  const em = server.ext.orm.em.fork();
  const updateTime = await em.findOne(SystemState, { key: SystemState.KEYS.UPDATE_SLURM_BLOCK_STATUS });
  expect(updateTime).not.toBeNull();
});

it("update block status", async () => {
  const blockedData = await updateBlockStatusInSlurm(server.ext.orm.em.fork(), server.ext.clusters, server.logger);

  expect(blockedData.blockedAccounts).toEqual([data.blockedAccountB.accountName]);
  expect(blockedData.blockedUserAccounts).toEqual([
    [data.uaAA.user.getProperty("userId"), data.uaAA.account.getProperty("accountName")],
  ]);
});

it("update block status with whitelist accounts", async () => {
  const client = new AccountServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
  await asyncClientCall(client, "whitelistAccount", {
    tenantName: data.tenant.name,
    accountName: data.blockedAccountB.accountName,
    comment: "test",
    operatorId: "123",
    expirationTime: new Date("2125-01-01T00:00:00.000Z").toISOString(),
  });

  const blockedData = await updateBlockStatusInSlurm(server.ext.orm.em.fork(), server.ext.clusters, server.logger);

  expect(blockedData.blockedAccounts).not.toContain([data.blockedAccountB.id]);
});

it("gets current sync block status info", async () => {
  const client = new AdminServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
  const info = await asyncClientCall(client, "getSyncBlockStatusInfo", {});

  expect(info.syncStarted).toEqual(misConfig.periodicSyncUserAccountBlockStatus?.enabled);
  expect(info.schedule).toEqual(misConfig.periodicSyncUserAccountBlockStatus?.cron ?? "0 4 * * *");
});

it("sync unblock and block account", async () => {
  const client = new AdminServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
  const info = await asyncClientCall(client, "syncBlockStatus", {});

  expect(info.blockedFailedAccounts).not.toContain(data.blockedAccountB.accountName);
  expect(info.blockedFailedUserAccounts).not.toContain([
    [data.uaAA.user.getProperty("userId"), data.uaAA.account.getProperty("accountName")],
  ]);
  expect(info.unblockedFailedAccounts).not.toContain(data.unblockedAccountA.accountName);
});

it("starts and stops sync block status ", async () => {
  const client = new AdminServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
  await asyncClientCall(client, "setSyncBlockStatusState", { started: false });

  let info = await asyncClientCall(client, "getSyncBlockStatusInfo", {});

  expect(info.syncStarted).toBeFalse();

  await asyncClientCall(client, "setSyncBlockStatusState", { started: true });

  info = await asyncClientCall(client, "getSyncBlockStatusInfo", {});

  expect(info.syncStarted).toBeTrue();
});
