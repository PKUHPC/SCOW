import { Server } from "@ddadaal/tsgrpc-server";
import { ListAccountUserSynchronizationsResponse_SyncResult,
  ListAccountUserSynchronizationsResponse_SyncStatus } from "@scow/protos/build/server/admin";
import { createServer } from "src/app";
import { startAccountUserSynchronization } from "src/bl/syncAccountUser";
import { AccountUserSyncRecord, SyncResult, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { insertSyncAccountUserData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;

beforeEach(async () => {

  server = await createServer();

  const em = server.ext.orm.em.fork();

  await insertSyncAccountUserData(em);

  await server.start();
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});


it.skip("start an account user synchronization", async () => {

  const em = server.ext.orm.em.fork();
  const sessionId = await startAccountUserSynchronization(
    em, server.ext.clusters, server.logger, server.ext.resource, undefined, 5, server.ext.fetch);

  expect(typeof sessionId).toBe("string");

  const syncRecord1 = await em.findOne(AccountUserSyncRecord, { sessionId });
  expect(syncRecord1?.syncStatus).toBe(SyncStatus.RUNNING);

  // 等待异步任务完成
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const syncRecord2 = await em.findOne(AccountUserSyncRecord, { sessionId });
  expect(syncRecord2?.syncStatus).toBe(SyncStatus.COMPLETED);
  expect(syncRecord2?.syncResult).toBe(SyncResult.FAILED);

  const clusterResults = syncRecord2?.syncDetails ?? [];
  expect(clusterResults.length).toBe(3);
  expect(clusterResults[0]?.completedTotalSyncCount).toBe(5);
  expect(clusterResults[0]?.successfulTotalSyncCount).toBe(3);
  expect(clusterResults[0]?.clusterSyncResult).toBe(ListAccountUserSynchronizationsResponse_SyncResult.FAILED);
  expect(clusterResults[0]?.clusterSyncStatus).toBe(ListAccountUserSynchronizationsResponse_SyncStatus.COMPLETED);
  expect(clusterResults[0]?.isAllChunkExecuted).toBeTrue();
  expect(clusterResults[0]?.executedChunkCount).toBe(1);

});

