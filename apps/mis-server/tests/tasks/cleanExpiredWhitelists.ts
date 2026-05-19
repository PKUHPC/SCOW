import { Server } from "@ddadaal/tsgrpc-server";
import { wrap } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { createServer } from "src/app";
import { Account } from "src/entities/Account";
import { AccountUserSyncRecord, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { cleanExpiredWhitelists } from "src/tasks/cleanExpiredWhitelists";
import { checkRunningSyncTask, updateStuckRunningSync } from "src/utils/synchronizationUtils";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

jest.mock("src/utils/synchronizationUtils");
jest.mock("src/bl/block");

describe("cleanExpiredWhitelists", () => {
  let server: Server;
  let em: SqlEntityManager<MySqlDriver>;
  let data: InitialData;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    server = await createServer();
    // await server.start();

    em = server.ext.orm.em.fork();
    data = await insertInitialData(em);
  });

  afterEach(async () => {
    await dropDatabase(server.ext.orm);
    await server.close();
    jest.useRealTimers();
  });

  it("should process expired whitelists when no sync task is running", async () => {
    (checkRunningSyncTask as jest.Mock).mockResolvedValue(false);

    // Create an expired whitelist
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);

    const whitelist = new AccountWhitelist({
      account: data.accountA,
      expirationTime: expiredDate,
      comment: "test",
      operatorId: "test",
    });
    data.accountA.whitelist = wrap(whitelist).toReference();

    await em.persistAndFlush([whitelist, data.accountA]);

    await cleanExpiredWhitelists(em.fork(), server.logger, server.ext.clusters);

    const checkEm = server.ext.orm.em.fork();
    const foundWhitelist = await checkEm.findOne(AccountWhitelist, { id: whitelist.id });
    expect(foundWhitelist).toBeNull();

    const account = await checkEm.findOne(Account, { id: data.accountA.id }, { populate: ["whitelist"] });
    expect(account?.whitelist).toBeUndefined();
  });

  it("should wait for sync task and then process expired whitelists", async () => {
    // Sync task runs once then finishes
    (checkRunningSyncTask as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    // Create an expired whitelist
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);

    const whitelist = new AccountWhitelist({
      account: data.accountA,
      expirationTime: expiredDate,
      comment: "test",
      operatorId: "test",
    });
    data.accountA.whitelist = wrap(whitelist).toReference();
    await em.persistAndFlush([whitelist, data.accountA]);

    const taskPromise = cleanExpiredWhitelists(em.fork(), server.logger, server.ext.clusters);

    // Fast-forward time for the 5000ms wait
    await jest.runAllTimersAsync();

    await taskPromise;

    const checkEm = server.ext.orm.em.fork();
    const foundWhitelist = await checkEm.findOne(AccountWhitelist, { id: whitelist.id });
    expect(foundWhitelist).toBeNull();
  });

  it("should stop sync task if it runs too long (timeout) and process expired whitelists", async () => {
    // Sync task keeps running
    (checkRunningSyncTask as jest.Mock).mockResolvedValue(true);

    // For this test, let's just insert a fake running sync record in DB
    const runningSyncRecord = new AccountUserSyncRecord({
      sessionId: "test-session",
      maxSyncDurationMinutes: 100,
      syncStatus: SyncStatus.RUNNING,
    });

    runningSyncRecord.startTime = new Date();
    await em.persistAndFlush(runningSyncRecord);

    // Create an expired whitelist
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    const whitelist = new AccountWhitelist({
      account: data.accountB,
      expirationTime: expiredDate,
      comment: "test",
      operatorId: "test",
    });
    data.accountB.whitelist = wrap(whitelist).toReference();
    await em.persistAndFlush([whitelist, data.accountB]);

    // Start the task
    const taskPromise = cleanExpiredWhitelists(em.fork(), server.logger, server.ext.clusters);

    // Advance time
    const startTime = Date.now();
    jest.setSystemTime(startTime + 11 * 60 * 1000);
    await jest.runAllTimersAsync();

    await taskPromise;

    // Verify whitelist deleted
    const checkEm = server.ext.orm.em.fork();
    const foundWhitelist = await checkEm.findOne(AccountWhitelist, { id: whitelist.id });
    expect(foundWhitelist).toBeNull();

    // Verify updateStuckRunningSync called
    expect(updateStuckRunningSync).toHaveBeenCalled();
  });
});
