import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { SystemState } from "src/entities/SystemState";
import { blockAccount, unblockAccount } from "src/bl/block";
import { callHook } from "src/plugins/hookClient";
import {
  ACCOUNT_QUOTA_STATE,
  blockAccountStorageQuotas,
  restoreBlockedAccountStorageQuotas,
} from "src/utils/storageQuota";

jest.mock("@ddadaal/tsgrpc-client", () => ({
  asyncClientCall: jest.fn(async (_client, method) =>
    method === "getClusterConfig" ? { partitions: [] } : {},
  ),
}));

jest.mock("src/plugins/hookClient", () => ({
  callHook: jest.fn(async () => ({})),
}));

jest.mock("src/utils/storageQuota", () => {
  const actual = jest.requireActual("src/utils/storageQuota");
  return {
    ...actual,
    blockAccountStorageQuotas: jest.fn(async () => ({})),
    restoreBlockedAccountStorageQuotas: jest.fn(async () => ({})),
  };
});

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const currentActivatedClusters = {
  hpc01: {} as any,
};

const scowResourcePlugin = {
  getAccountAssignedPartitionsForCluster: jest.fn(async () => []),
};

const createClusterPlugin = () => ({
  callOnAll: jest.fn(async (_clusters, _logger, fn) => {
    await fn({ account: {} });
  }),
  callOnOne: jest.fn(async (_clusterId, _logger, fn) => {
    await fn({ account: {}, config: {} });
  }),
});

const createEm = (state?: string) => ({
  findOne: jest.fn(async (_entity, query) => {
    if (query.key === SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE && state !== undefined) {
      return { value: state };
    }
    return undefined;
  }),
});

const createAccount = (blockedInCluster: boolean) => {
  return {
    accountName: "account",
    blockedInCluster,
    tenant: {
      $: { name: "tenant" },
      getProperty: jest.fn(() => "tenant"),
    },
  } as any;
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("blocks account storage quotas only when account storage quota is enabled", async () => {
  const account = createAccount(false);
  const em = createEm(ACCOUNT_QUOTA_STATE.ENABLED);
  const clusterPlugin = createClusterPlugin();

  await blockAccount(account, currentActivatedClusters, clusterPlugin as any, logger as any, em as any);

  expect(blockAccountStorageQuotas).toHaveBeenCalledWith(em, account, logger);
  expect(callHook).toHaveBeenCalledWith("accountBlocked", { accountName: "account", tenantName: "tenant" }, logger);
});

it.each([undefined, ACCOUNT_QUOTA_STATE.DISABLED, ACCOUNT_QUOTA_STATE.ENABLING])(
  "does not block account storage quotas when account storage quota state is %s",
  async (state) => {
    const account = createAccount(false);
    const em = createEm(state);
    const clusterPlugin = createClusterPlugin();

    await blockAccount(account, currentActivatedClusters, clusterPlugin as any, logger as any, em as any);

    expect(blockAccountStorageQuotas).not.toHaveBeenCalled();
    expect(account.blockedInCluster).toBe(true);
  },
);

it("restores account storage quotas only when account storage quota is enabled", async () => {
  const account = createAccount(true);
  const em = createEm(ACCOUNT_QUOTA_STATE.ENABLED);
  const clusterPlugin = createClusterPlugin();

  await unblockAccount(
    account,
    currentActivatedClusters,
    clusterPlugin as any,
    logger as any,
    scowResourcePlugin as any,
    em as any,
  );

  expect(restoreBlockedAccountStorageQuotas).toHaveBeenCalledWith(em, account, logger);
  expect(callHook).toHaveBeenCalledWith("accountUnblocked", { accountName: "account", tenantName: "tenant" }, logger);
});

it.each([undefined, ACCOUNT_QUOTA_STATE.DISABLED, ACCOUNT_QUOTA_STATE.ENABLING])(
  "does not restore account storage quotas when account storage quota state is %s",
  async (state) => {
    const account = createAccount(true);
    const em = createEm(state);
    const clusterPlugin = createClusterPlugin();

    await unblockAccount(
      account,
      currentActivatedClusters,
      clusterPlugin as any,
      logger as any,
      scowResourcePlugin as any,
      em as any,
    );

    expect(restoreBlockedAccountStorageQuotas).not.toHaveBeenCalled();
    expect(account.blockedInCluster).toBe(false);
  },
);

it("rolls back slurm block when enabled account storage quota blocking fails", async () => {
  const account = createAccount(false);
  const em = createEm(ACCOUNT_QUOTA_STATE.ENABLED);
  const clusterPlugin = createClusterPlugin();
  const error = new Error("quota failed");
  (blockAccountStorageQuotas as jest.Mock).mockRejectedValueOnce(error);

  await expect(blockAccount(account, currentActivatedClusters, clusterPlugin as any, logger as any, em as any))
    .rejects.toThrow(error);

  expect(clusterPlugin.callOnAll).toHaveBeenCalledTimes(2);
  expect(asyncClientCall).toHaveBeenNthCalledWith(1, expect.anything(), "blockAccount", { accountName: "account" });
  expect(asyncClientCall).toHaveBeenNthCalledWith(2, expect.anything(), "unblockAccount", { accountName: "account" });
});

it("rolls back slurm unblock when enabled account storage quota restoring fails", async () => {
  const account = createAccount(true);
  const em = createEm(ACCOUNT_QUOTA_STATE.ENABLED);
  const clusterPlugin = createClusterPlugin();
  const error = new Error("quota failed");
  (restoreBlockedAccountStorageQuotas as jest.Mock).mockRejectedValueOnce(error);

  await expect(unblockAccount(
    account,
    currentActivatedClusters,
    clusterPlugin as any,
    logger as any,
    scowResourcePlugin as any,
    em as any,
  ))
    .rejects.toThrow(error);

  expect(scowResourcePlugin.getAccountAssignedPartitionsForCluster).toHaveBeenCalledWith({
    accountName: "account",
    tenantName: "tenant",
    clusterId: "hpc01",
  });
  expect(clusterPlugin.callOnOne).toHaveBeenCalledTimes(1);
  expect(clusterPlugin.callOnAll).toHaveBeenCalledTimes(1);
  expect(asyncClientCall).toHaveBeenCalledWith(
    expect.anything(),
    "blockAccount",
    { accountName: "account" },
  );
});
