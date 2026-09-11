import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { createServer } from "src/app";
import { Account } from "src/entities/Account";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { getScowdClient } from "src/utils/scowd";
import { ACCOUNT_QUOTA_STATE } from "src/utils/storageQuota";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient } from "tests/utils";

jest.mock("src/utils/storageExecutionTarget", () => ({
  resolveStorageExecutionTarget: jest.fn(async () => ({
    executionCluster: "hpc01",
    executionPath: "/data",
    executionStorage: {
      storageId: "data",
      mountPath: "/data",
      fs: { type: "nfs", nfs: { version: "3.0" } },
      clusterId: "hpc01",
      storage: {
        storageId: "data",
        quotaEnabled: true,
        replicaExist: false,
        fs: { type: "nfs", nfs: { version: "3.0" } },
      },
    },
    mountedClusters: ["hpc01"],
  })),
  executeStorageOperationWithFailover: jest.fn(async (_storageId, _em, _logger, operation) => {
    const target = {
      executionCluster: "hpc01",
      executionPath: "/data",
      executionStorage: {
        storageId: "data",
        mountPath: "/data",
        fs: { type: "nfs", nfs: { version: "3.0" } },
        clusterId: "hpc01",
        storage: {
          storageId: "data",
          quotaEnabled: true,
          replicaExist: false,
          fs: { type: "nfs", nfs: { version: "3.0" } },
        },
      },
    };
    return { ...target, mountedClusters: ["hpc01"], result: await operation(target) };
  }),
  resolveStorageExecutionTargetWithContext: jest.fn(),
  executeStorageOperationWithFailoverWithContext: jest.fn(),
}));

const getFilesystemStorageUsage = jest.fn(async () => ({
  totalStorageMb: BigInt(1024),
  usedStorageMb: BigInt(0),
}));
const setGroupStorageQuota = jest.fn(async () => ({}));

jest.mock("src/utils/scowd", () => ({
  getScowdClient: jest.fn(() => ({
    storageQuota: {
      getFilesystemStorageUsage,
      setGroupStorageQuota,
    },
  })),
  mapConnectRpcStatusToGrpc: jest.fn((code) => code),
}));

let server: Server;
let client: StorageServiceClient;

beforeEach(async () => {
  getFilesystemStorageUsage.mockClear();
  setGroupStorageQuota.mockClear();
  (getScowdClient as jest.Mock).mockClear();

  server = await createServer();
  await server.start();
  client = createTestClient(server.serverAddress, StorageServiceClient);
});

afterEach(async () => {
  if (server) {
    await dropDatabase(server.ext.orm);
    await server.close();
  }
});

it("does not set actual group storage quota for blocked accounts", async () => {
  const em = server.ext.orm.em.fork();
  const tenant = new Tenant({ name: "tenant" });
  const unblockedAccount = new Account({
    accountName: "unblocked",
    accountGroupName: "unblocked",
    tenant,
    blockedInCluster: false,
  });
  const blockedAccount = new Account({
    accountName: "blocked",
    accountGroupName: "blocked",
    tenant,
    blockedInCluster: true,
  });
  const quotaState = new SystemState("ACCOUNT_STORAGE_QUOTA_STATE", ACCOUNT_QUOTA_STATE.ENABLED);

  await em.persistAndFlush([tenant, unblockedAccount, blockedAccount, quotaState]);

  const reply = await asyncClientCall(client, "batchSetAccountStorageQuota", {
    tenantName: tenant.name,
    accountNames: [unblockedAccount.accountName, blockedAccount.accountName],
    storageId: "data",
    quotaMb: 512,
    useTenantDefaultAccountQuota: false,
  });

  expect(reply.failedAccountNames).toEqual([]);
  expect(setGroupStorageQuota).toHaveBeenCalledTimes(1);
  expect(setGroupStorageQuota).toHaveBeenCalledWith(expect.objectContaining({
    groupName: "unblocked",
    path: "/data",
    quotaMb: BigInt(512),
  }));

  em.clear();
  const unblockedQuota = await em.findOneOrFail(AccountStorageQuota, {
    account: { accountName: unblockedAccount.accountName },
    storageId: "data",
  });
  const blockedQuota = await em.findOneOrFail(AccountStorageQuota, {
    account: { accountName: blockedAccount.accountName },
    storageId: "data",
  });

  expect(unblockedQuota.storageQuotaMb).toBe(BigInt(512));
  expect(blockedQuota.storageQuotaMb).toBe(BigInt(512));
});
