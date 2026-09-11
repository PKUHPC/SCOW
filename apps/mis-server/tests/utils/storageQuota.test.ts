import { status } from "@grpc/grpc-js";

const getFilesystemStorageUsage = jest.fn(async () => ({ totalStorageMb: 1024 }));
const setGroupStorageQuota = jest.fn(async () => ({}));
const setUserStorageQuota = jest.fn(async () => ({}));
const getHomeDirectory = jest.fn(async () => ({ path: "/home/user1" }));
const changeOwner = jest.fn(async () => ({}));
const resolveScowdQuotaGroupNames = jest.fn(async (groupNames: string[]) => ({
  groupNames,
  groupNameMap: new Map(groupNames.map((groupName) => [groupName, groupName])),
}));
const getScowdQuotaGroupNameForStorage = jest.fn(
  (groupName: string, _storage: unknown, groupNameMap: Map<string, string>) => groupNameMap.get(groupName) ?? groupName,
);

jest.mock("@scow/config/build/cluster", () => ({
  getClusterConfigs: jest.fn(() => ({})),
}));

jest.mock("@scow/lib-server", () => ({
  buildStorageConfigProto: jest.fn((storage) => storage),
  getClusterQuotaStorageConfigs: jest.fn(() => []),
  getExecutableStorageIds: jest.fn(() => ["data"]),
}));

jest.mock("src/bl/clustersUtils", () => ({
  getActivatedClusters: jest.fn(async () => ({ hpc01: {} })),
}));

jest.mock("src/config/clusters", () => ({
  configClusters: {},
}));

jest.mock("src/config/mis", () => ({
  misConfig: {},
}));

jest.mock("src/utils/scowd", () => ({
  getScowdClient: jest.fn(() => ({
    file: {
      getHomeDirectory,
      changeOwner,
    },
    storageQuota: {
      getFilesystemStorageUsage,
      setGroupStorageQuota,
      setUserStorageQuota,
    },
  })),
}));

jest.mock("src/utils/storageExecutionTarget", () => ({
  resolveStorageExecutionTarget: jest.fn(async () => ({
    executionCluster: "hpc01",
    executionPath: "/data",
    executionStorage: { storageId: "data" },
  })),
  executeStorageOperationWithFailover: jest.fn(async (_storageId, _em, _logger, operation) => {
    const target = {
      executionCluster: "hpc01",
      executionPath: "/data",
      executionStorage: { storageId: "data", mountPath: "/data", fs: { type: "nfs" } },
    };
    return { ...target, mountedClusters: ["hpc01"], result: await operation(target) };
  }),
}));

jest.mock("src/utils/scowdQuotaGroupName", () => ({
  resolveScowdQuotaGroupNames,
  getScowdQuotaGroupNameForStorage,
}));

import { getClusterQuotaStorageConfigs } from "@scow/lib-server";
import { configClusters } from "src/config/clusters";
import { Account, AccountState } from "src/entities/Account";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { SystemState } from "src/entities/SystemState";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { User } from "src/entities/User";
import { getScowdClient } from "src/utils/scowd";
import {
  changeAllUsersFileGroupToAccountGroup,
  blockAccountStorageQuotas,
  checkAndFixUserGroupsForAccountQuota,
  initializeCreatedAccountGroupStorageQuota,
  prepareImportedRelationsForAccountQuota,
  restoreBlockedAccountStorageQuotas,
  validateImportedUserAccountRelations,
} from "src/utils/storageQuota";

const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

const groupService = {
  getGroupGid: jest.fn(),
  getUserUidNumber: jest.fn(),
};

it("reuses cached LDAP groups during account quota group fixing", async () => {
  const listUserGroups = jest.fn(async () => [{ name: "user1", gid: 1000 }]);
  const service = {
    listUserGroups,
    setUserPrimaryGroup: jest.fn(),
    removeUserFromGroup: jest.fn(),
  };
  const cached = new Map([["user1", [{ name: "user1", gid: 1000 }, { name: "account1", gid: 2000 }]]]);

  await checkAndFixUserGroupsForAccountQuota(
    ["user1"],
    service as any,
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    cached,
  );

  expect(listUserGroups).not.toHaveBeenCalled();
  expect(service.setUserPrimaryGroup).toHaveBeenCalledWith("user1", "account1");
  expect(service.removeUserFromGroup).toHaveBeenCalledWith("user1", "user1");
});

const createEm = () => {
  const stateRecord = { value: "enabling" };
  return {
    find: jest.fn(async (entity, query) => {
      if (entity === User) return [];
      if (entity === Account) {
        expect(query).toEqual({
          blockedInCluster: true,
          state: { $ne: AccountState.DELETED },
        });
        return [{ accountName: "blocked", accountGroupName: "blocked" }];
      }
      return [];
    }),
    findOne: jest.fn(async (entity, query) => {
      if (entity === SystemState && query.key === SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE) {
        return stateRecord;
      }
      return undefined;
    }),
    persistAndFlush: jest.fn(async () => undefined),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  getFilesystemStorageUsage.mockReset().mockResolvedValue({ totalStorageMb: 1024 });
  setGroupStorageQuota.mockReset().mockResolvedValue({});
  setUserStorageQuota.mockReset().mockResolvedValue({});
  getHomeDirectory.mockReset().mockResolvedValue({ path: "/home/user1" });
  changeOwner.mockReset().mockResolvedValue({});
  resolveScowdQuotaGroupNames.mockReset().mockImplementation(async (groupNames: string[]) => ({
    groupNames,
    groupNameMap: new Map(groupNames.map((groupName) => [groupName, groupName])),
  }));
  getScowdQuotaGroupNameForStorage.mockClear();
  jest.mocked(getClusterQuotaStorageConfigs).mockReset().mockReturnValue([]);
  for (const clusterId of Object.keys(configClusters)) delete configClusters[clusterId];
});

afterEach(() => {
  for (const clusterId of Object.keys(configClusters)) delete configClusters[clusterId];
});

it("sets blocked account storage quota to blocked quota when enabling account storage quota", async () => {
  const em = createEm();

  await changeAllUsersFileGroupToAccountGroup(em as any, "operator", groupService as any, logger as any);

  expect(setGroupStorageQuota).toHaveBeenCalledTimes(1);
  expect(setGroupStorageQuota).toHaveBeenCalledWith(expect.objectContaining({
    groupName: "blocked",
    path: "/data",
    quotaMb: BigInt(10),
  }));
  expect(em.persistAndFlush).toHaveBeenCalledWith({ value: "enabled" });
});

describe("initializeCreatedAccountGroupStorageQuota", () => {
  const storage = { storageId: "data", mountPath: "/data", fs: { type: "nfs" } };

  beforeEach(() => {
    Object.assign(configClusters, { hpc01: { scowd: { enabled: true } } });
    jest.mocked(getClusterQuotaStorageConfigs).mockReturnValue([storage] as any);
  });

  it("sets the blocked quota for a blocked account", async () => {
    const em = { find: jest.fn(async () => []) };

    await initializeCreatedAccountGroupStorageQuota(
      "account",
      "account_group",
      "default",
      true,
      em as any,
      logger as any,
    );

    expect(em.find).not.toHaveBeenCalled();
    expect(setGroupStorageQuota).toHaveBeenCalledWith({
      groupName: "account_group",
      path: "/data",
      quotaMb: BigInt(10),
      storage,
    });
  });

  it("uses the tenant default quota for an unblocked account", async () => {
    const em = {
      find: jest.fn(async (entity) =>
        entity === TenantStorageQuota ? [{ storageId: "data", accountDefaultQuota: BigInt(512) }] : [],
      ),
    };

    await initializeCreatedAccountGroupStorageQuota(
      "account",
      "account_group",
      "default",
      false,
      em as any,
      logger as any,
    );

    expect(getFilesystemStorageUsage).not.toHaveBeenCalled();
    expect(setGroupStorageQuota).toHaveBeenCalledWith(expect.objectContaining({ quotaMb: BigInt(512) }));
  });

  it("rolls back touched scowd quotas and throws after a storage failure", async () => {
    setGroupStorageQuota
      .mockRejectedValueOnce(new Error("scowd unavailable"))
      .mockResolvedValue({});
    const em = { find: jest.fn(async () => []) };

    await expect(
      initializeCreatedAccountGroupStorageQuota("account", "account_group", "default", false, em as any, logger as any),
    ).rejects.toThrow("Storage quota initialization failed for account account");

    expect(setGroupStorageQuota).toHaveBeenCalledTimes(2);
    expect(setGroupStorageQuota).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: "/data",
        quotaMb: BigInt(10),
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        accountName: "account",
        accountGroupName: "account_group",
        blockedInCluster: false,
      }),
      "Failed to initialize storage quota for newly created account group; applying blocked quota compensation",
    );
  });

  it("sets a shared storage only once after a successful initialization", async () => {
    Object.assign(configClusters, { hpc02: { scowd: { enabled: true } } });
    const em = { find: jest.fn(async () => []) };

    await initializeCreatedAccountGroupStorageQuota(
      "account",
      "account_group",
      "default",
      true,
      em as any,
      logger as any,
    );

    expect(setGroupStorageQuota).toHaveBeenCalledTimes(1);
  });

  it("throws without calling scowd when group name resolution fails", async () => {
    const error = new Error("LDAP lookup failed");
    resolveScowdQuotaGroupNames.mockRejectedValueOnce(error);
    const em = { find: jest.fn(async () => []) };

    await expect(
      initializeCreatedAccountGroupStorageQuota("account", "10001", "default", false, em as any, logger as any),
    ).rejects.toBe(error);

    expect(em.find).toHaveBeenCalled();
    expect(setGroupStorageQuota).not.toHaveBeenCalled();
  });

  it("uses an activated execution target instead of a configured deactivated cluster", async () => {
    for (const clusterId of Object.keys(configClusters)) delete configClusters[clusterId];
    Object.assign(configClusters, { deactivated: { scowd: { enabled: true } } });
    const em = { find: jest.fn(async () => []) };

    await initializeCreatedAccountGroupStorageQuota(
      "account",
      "account_group",
      "default",
      true,
      em as any,
      logger as any,
    );

    expect(getScowdClient).not.toHaveBeenCalledWith("deactivated");
    expect(getScowdClient).toHaveBeenCalledWith("hpc01");
  });
});

describe("account block storage quotas", () => {
  const createAccount = () =>
    ({
      accountName: "account",
      accountGroupName: "account_group",
      blockedInCluster: false,
      tenant: {},
    }) as Account;

  it("blocks only the account group quota and keeps user quotas unchanged", async () => {
    await blockAccountStorageQuotas({} as any, createAccount() as any, logger as any);

    expect(setGroupStorageQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        groupName: "account_group",
        quotaMb: BigInt(10),
      }),
    );
    expect(setUserStorageQuota).not.toHaveBeenCalled();
  });

  it("restores only the account group quota and keeps user quotas unchanged", async () => {
    const em = {
      findOne: jest.fn(async (entity) =>
        entity === AccountStorageQuota ? { storageQuotaMb: BigInt(512) } : undefined,
      ),
    };

    await restoreBlockedAccountStorageQuotas(em as any, createAccount() as any, logger as any);

    expect(setGroupStorageQuota).toHaveBeenCalledWith(
      expect.objectContaining({
        groupName: "account_group",
        quotaMb: BigInt(512),
      }),
    );
    expect(setUserStorageQuota).not.toHaveBeenCalled();
  });
});

it("adds imported user to an existing account group and switches its primary group", async () => {
  const existingAccountGroupName = "account_group";
  const userId = "user1";
  const importedGroupService = {
    checkGroupExists: jest.fn(async () => true),
    createGroup: jest.fn(async () => undefined),
    getGroupGid: jest.fn(async (groupName: string) => (groupName === userId ? 1000 : 2000)),
    getGroupNameByGid: jest.fn(async () => userId),
    getUserUidNumber: jest.fn(async () => 1000),
    addUserToGroup: jest.fn(async () => undefined),
    setUserPrimaryGroup: jest.fn(async () => undefined),
    removeUserFromGroup: jest.fn(async () => undefined),
  };
  const account = {
    id: 1,
    accountName: "account",
    accountGroupName: existingAccountGroupName,
    tenant: { getEntity: () => ({ name: "default" }) },
  };

  await prepareImportedRelationsForAccountQuota(
    { find: jest.fn(async () => []) } as any,
    [{ account: account as Account, userId, ownerId: "operator" }],
    importedGroupService as any,
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    true,
    logger as any,
  );

  expect(importedGroupService.addUserToGroup).toHaveBeenCalledWith(userId, existingAccountGroupName);
  expect(importedGroupService.createGroup).not.toHaveBeenCalled();
  expect(importedGroupService.setUserPrimaryGroup).toHaveBeenCalledWith(userId, existingAccountGroupName);
  expect(importedGroupService.removeUserFromGroup).toHaveBeenCalledWith(userId, userId);
});

it("maintains imported directory group membership without applying account quota operations", async () => {
  const accountGroupName = "account_group";
  const importedGroupService = {
    checkGroupExists: jest.fn(async () => false),
    createGroup: jest.fn(async () => undefined),
    addUserToGroup: jest.fn(async () => undefined),
    getGroupGid: jest.fn(),
    setUserPrimaryGroup: jest.fn(),
    removeUserFromGroup: jest.fn(),
  };
  const account = {
    id: 1,
    accountName: "account",
    accountGroupName,
    tenant: { getEntity: () => ({ name: "default" }) },
  };

  await prepareImportedRelationsForAccountQuota(
    {} as any,
    [{ account: account as Account, userId: "user1", ownerId: "owner1" }],
    importedGroupService as any,
    {} as any,
    true,
    logger as any,
    false,
  );

  expect(importedGroupService.createGroup).toHaveBeenCalledWith(accountGroupName);
  expect(importedGroupService.addUserToGroup).toHaveBeenCalledWith("user1", accountGroupName);
  expect(importedGroupService.getGroupGid).not.toHaveBeenCalled();
  expect(importedGroupService.setUserPrimaryGroup).not.toHaveBeenCalled();
  expect(importedGroupService.removeUserFromGroup).not.toHaveBeenCalled();
});

it("reuses a failed imported account group only for the same owner", async () => {
  const accountGroupName = "account_group";
  const importedGroupService = {
    checkGroupExists: jest.fn(async () => true),
    listUserGroups: jest.fn(async () => [{ name: accountGroupName, gid: 2000 }]),
    getUserPrimaryGroup: jest.fn(async () => "default_group"),
    createGroup: jest.fn(async () => undefined),
    getGroupGid: jest.fn(async () => 2000),
    getGroupNameByGid: jest.fn(async () => "default_group"),
    getUserUidNumber: jest.fn(async () => 1000),
    addUserToGroup: jest.fn(async () => undefined),
    setUserPrimaryGroup: jest.fn(async () => undefined),
    removeUserFromGroup: jest.fn(async () => undefined),
  };
  const account = {
    accountName: "account",
    accountGroupName,
    tenant: { getEntity: () => ({ name: "default", defaultAccountBlockThreshold: { gte: () => false } }) },
  } as Account;

  await expect(prepareImportedRelationsForAccountQuota(
    { find: jest.fn(async () => []) } as any,
    [{ account, userId: "owner", ownerId: "owner" }],
    importedGroupService as any,
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    true,
    logger as any,
  )).resolves.toBeUndefined();

  expect(importedGroupService.createGroup).not.toHaveBeenCalled();
  expect(importedGroupService.addUserToGroup).toHaveBeenCalledWith("owner", accountGroupName);
});

it("rejects an existing imported account group that cannot be associated with the requested owner", async () => {
  const accountGroupName = "account_group";
  const importedGroupService = {
    checkGroupExists: jest.fn(async () => true),
    listUserGroups: jest.fn(async () => [{ name: "other_group", gid: 1000 }]),
    getUserPrimaryGroup: jest.fn(async () => "other_group"),
    createGroup: jest.fn(async () => undefined),
    addUserToGroup: jest.fn(async () => undefined),
  };
  const account = {
    accountName: "account",
    accountGroupName,
    tenant: { getEntity: () => ({ name: "default", defaultAccountBlockThreshold: { gte: () => false } }) },
  } as Account;

  await expect(prepareImportedRelationsForAccountQuota(
    { find: jest.fn(async () => []) } as any,
    [{ account, userId: "new-owner", ownerId: "new-owner" }],
    importedGroupService as any,
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    true,
    logger as any,
  )).rejects.toMatchObject({
    code: status.ALREADY_EXISTS,
    details: "DIRECTORY_GROUP_ALREADY_EXISTS",
  });

  expect(importedGroupService.addUserToGroup).not.toHaveBeenCalled();
});

it("allows multiple imported users to belong to the same account when account quota is enabled", async () => {
  const em = { find: jest.fn(async () => []) };

  await expect(
    validateImportedUserAccountRelations(em as any, [
      { userId: "user1", accountName: "account" },
      { userId: "user2", accountName: "account" },
    ]),
  ).resolves.toBeUndefined();
});

it("creates a missing account group once before adding imported users", async () => {
  const accountGroupName = "account_group";
  const importedGroupService = {
    checkGroupExists: jest.fn(async () => false),
    createGroup: jest.fn(async () => undefined),
    getGroupGid: jest.fn(async (groupName: string) => (groupName === accountGroupName ? 2000 : 1000)),
    getGroupNameByGid: jest.fn(async () => "default_group"),
    getUserUidNumber: jest.fn(async () => 1000),
    addUserToGroup: jest.fn(async () => undefined),
    setUserPrimaryGroup: jest.fn(async () => undefined),
    removeUserFromGroup: jest.fn(async () => undefined),
  };
  const account = {
    accountName: "account",
    accountGroupName,
    tenant: { getEntity: () => ({ name: "default" }) },
  };

  await prepareImportedRelationsForAccountQuota(
    { find: jest.fn(async () => []) } as any,
    [
      { account: account as Account, userId: "user1", ownerId: "owner" },
      { account: account as Account, userId: "user2", ownerId: "owner" },
    ],
    importedGroupService as any,
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    true,
    logger as any,
  );

  expect(importedGroupService.checkGroupExists).toHaveBeenCalledTimes(1);
  expect(importedGroupService.createGroup).toHaveBeenCalledTimes(1);
  expect(importedGroupService.createGroup).toHaveBeenCalledWith(accountGroupName);
  expect(importedGroupService.addUserToGroup).toHaveBeenCalledTimes(2);
});

it("initializes an imported blocked account group with the blocked quota", async () => {
  Object.assign(configClusters, { hpc01: { scowd: { enabled: true } } });
  jest.mocked(getClusterQuotaStorageConfigs).mockReturnValue([{ storageId: "data", mountPath: "/data" }] as any);
  const accountGroupName = "blocked_account_group";
  const importedGroupService = {
    checkGroupExists: jest.fn(async () => false),
    createGroup: jest.fn(async () => undefined),
    getGroupGid: jest.fn(async (groupName: string) => (groupName === accountGroupName ? 2000 : 1000)),
    getGroupNameByGid: jest.fn(async () => "default_group"),
    getUserUidNumber: jest.fn(async () => 1000),
    addUserToGroup: jest.fn(async () => undefined),
    setUserPrimaryGroup: jest.fn(async () => undefined),
    removeUserFromGroup: jest.fn(async () => undefined),
  };
  const tenant = { name: "default", defaultAccountBlockThreshold: { gte: () => false } };
  const account = {
    accountName: "blocked_account",
    accountGroupName,
    blockedInCluster: true,
    tenant: { getEntity: () => tenant },
  } as Account;

  await prepareImportedRelationsForAccountQuota(
    { find: jest.fn(async () => []) } as any,
    [{ account, userId: "user1", ownerId: "owner" }],
    importedGroupService as any,
    { directoryService: { ldap: { addUser: { groupStrategy: "newGroupPerUser" } } } } as any,
    false,
    logger as any,
  );

  expect(setGroupStorageQuota).toHaveBeenCalledWith(
    expect.objectContaining({
      groupName: accountGroupName,
      quotaMb: BigInt(10),
    }),
  );
});
