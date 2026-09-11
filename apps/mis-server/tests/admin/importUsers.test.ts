import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { MikroORM } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { Decimal } from "@scow/lib-decimal";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { createServer } from "src/app";
import * as blockOperations from "src/bl/block";
import { commonConfig } from "src/config/common";
import { Account } from "src/entities/Account";
import { AccountUserSyncRecord, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { SystemState } from "src/entities/SystemState";
import * as storageQuotaOperations from "src/utils/storageQuota";
import * as directoryGroupOperations from "src/utils/directoryGroup";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient, mockAccountResourceOperations } from "tests/utils";

let server: Server;
let orm: MikroORM<MySqlDriver>;
let client: AdminServiceClient;

beforeEach(async () => {
  server = await createServer();
  mockAccountResourceOperations(server.ext.resource);
  await server.start();

  client = createTestClient(server.serverAddress, AdminServiceClient);

  orm = server.ext.orm;
});

afterEach(async () => {
  await dropDatabase(orm);
  await server.close();
});

const data = {
  accounts: [
    {
      accountName: "a_user1",
      users: [
        { userId: "user1", userName: "user1Name", blocked: false },
        { userId: "user2", userName: "user2", blocked: true },
      ],
      owner: "user1",
      blocked: false,
    },
    {
      accountName: "account2",
      users: [
        { userId: "user2", userName: "user2", blocked: false },
        { userId: "user3", userName: "user3", blocked: true },
      ],
      owner: "user2",
      blocked: false,
    },
  ],
};

it("imports users and accounts", async () => {
  const em = orm.em.fork();

  // user1 has existed
  const tenant = await em.findOneOrFail(Tenant, { name: "default" });
  await em.persistAndFlush(new User({ name: "user1Name", userId: "user1", email: "", tenant }));

  await asyncClientCall(client, "importUsers", { data: data, whitelist: true });

  const accounts = await em.find(Account, {});
  expect(accounts.map((x) => x.accountName)).toIncludeSameMembers(data.accounts.map((x) => x.accountName));

  const ua = await em.find(
    UserAccount,
    {},
    {
      populate: ["account", "user"],
    },
  );
  expect(
    ua.map((x) => ({
      accountName: x.account.$.accountName,
      userId: x.user.$.userId,
      role: x.role,
      blocked: x.blockedInCluster === UserStatus.BLOCKED,
    })),
  ).toIncludeSameMembers([
    { accountName: "a_user1", userId: "user1", role: UserRole.OWNER, blocked: false },
    { accountName: "a_user1", userId: "user2", role: UserRole.USER, blocked: true },
    { accountName: "account2", userId: "user2", role: UserRole.OWNER, blocked: false },
    { accountName: "account2", userId: "user3", role: UserRole.USER, blocked: true },
  ]);

  const users = await em.find(User, {});
  expect(users.map((x) => ({ userId: x.userId, name: x.name }))).toIncludeSameMembers([
    { userId: "user1", name: "user1Name" },
    { userId: "user2", name: "user2" },
    { userId: "user3", name: "user3" },
  ]);
});

it("preserves the synchronization-running details when account user synchronization is running", async () => {
  const em = orm.em.fork();
  await em.persistAndFlush(
    new AccountUserSyncRecord({
      sessionId: "running-sync-session",
      syncStatus: SyncStatus.RUNNING,
      maxSyncDurationMinutes: 5,
    }),
  );

  await expect(asyncClientCall(client, "importUsers", { data, whitelist: true })).rejects.toMatchObject({
    code: Status.FAILED_PRECONDITION,
    details: expect.stringContaining("Account User Synchronization is running."),
  });
});

it("import users and accounts if in different tenant", async () => {
  const em = orm.em.fork();

  // user1 has existed in "tenant1"
  await em.persistAndFlush(new Tenant({ name: "tenant1" }));
  const tenant1 = await em.findOneOrFail(Tenant, { name: "tenant1" });
  await em.persistAndFlush(new User({ name: "user1Name", userId: "user1", email: "", tenant: tenant1 }));

  await asyncClientCall(client, "importUsers", { data: data, whitelist: true }).catch((e) => {
    console.log(e);
    expect(e.code).toBe(Status.INVALID_ARGUMENT);
  });
});

it("import users and accounts if an account exists", async () => {
  const em = orm.em.fork();

  // a_user1 and user1 exist
  const tenant = await em.findOneOrFail(Tenant, { name: "default" });
  const user = new User({ name: "user1Name", userId: "user1", email: "", tenant });
  const account = new Account({
    accountName: "a_user1",
    comment: "",
    blockedInCluster: false,
    tenant,
  });
  await em.persistAndFlush([user, account]);

  await asyncClientCall(client, "importUsers", { data: data, whitelist: true });

  const accounts = await em.find(Account, {});
  expect(accounts.map((x) => x.accountName)).toIncludeSameMembers(data.accounts.map((x) => x.accountName));

  const ua = await em.find(
    UserAccount,
    {},
    {
      populate: ["account", "user"],
    },
  );
  expect(
    ua.map((x) => ({
      accountName: x.account.$.accountName,
      userId: x.user.$.userId,
      role: x.role,
      blocked: x.blockedInCluster === UserStatus.BLOCKED,
    })),
  ).toIncludeSameMembers([
    { accountName: "a_user1", userId: "user1", role: UserRole.OWNER, blocked: false },
    { accountName: "a_user1", userId: "user2", role: UserRole.USER, blocked: true },
    { accountName: "account2", userId: "user2", role: UserRole.OWNER, blocked: false },
    { accountName: "account2", userId: "user3", role: UserRole.USER, blocked: true },
  ]);

  const users = await em.find(User, {});
  expect(users.map((x) => ({ userId: x.userId, name: x.name }))).toIncludeSameMembers([
    { userId: "user1", name: "user1Name" },
    { userId: "user2", name: "user2" },
    { userId: "user3", name: "user3" },
  ]);
});

it("rejects a user imported into different accounts when account quota is enabled", async () => {
  const em = orm.em.fork();
  await em.persistAndFlush(
    new SystemState(
      SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
      storageQuotaOperations.ACCOUNT_QUOTA_STATE.ENABLED,
    ),
  );
  const invalidData = {
    accounts: [
      { accountName: "account1", users: [{ userId: "user1", userName: "user1", blocked: false }], owner: "user1", blocked: false },
      { accountName: "account2", users: [{ userId: "user1", userName: "user1", blocked: false }], owner: "user1", blocked: false },
    ],
  };

  await expect(asyncClientCall(client, "importUsers", { data: invalidData, whitelist: true }))
    .rejects.toMatchObject({
      code: Status.FAILED_PRECONDITION,
      details: "MULTI_ACCOUNT_USERS:user1",
    });
});

it("rejects a user already belonging to another account when account quota is enabled", async () => {
  const em = orm.em.fork();
  const tenant = await em.findOneOrFail(Tenant, { name: "default" });
  const user = new User({ name: "user1", userId: "user1", email: "", tenant });
  const existingAccount = new Account({ accountName: "existing", tenant, blockedInCluster: false });
  await em.persistAndFlush([
    user,
    existingAccount,
    new UserAccount({ account: existingAccount, user, role: UserRole.USER, blockedInCluster: UserStatus.UNBLOCKED }),
    new SystemState(
      SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
      storageQuotaOperations.ACCOUNT_QUOTA_STATE.ENABLED,
    ),
  ]);
  const invalidData = {
    accounts: [{
      accountName: "new-account",
      users: [{ userId: "user1", userName: "user1", blocked: false }],
      owner: "user1",
      blocked: false,
    }],
  };

  await expect(asyncClientCall(client, "importUsers", { data: invalidData, whitelist: true }))
    .rejects.toMatchObject({
      code: Status.FAILED_PRECONDITION,
      details: "MULTI_ACCOUNT_USERS:user1",
    });
});

it("reconciles storage quota when importing an account that is already blocked", async () => {
  const em = orm.em.fork();
  const tenant = await em.findOneOrFail(Tenant, { name: "default" });
  const user = new User({ name: "user1", userId: "user1", email: "", tenant });
  const account = new Account({
    accountName: "blocked-account",
    accountGroupName: "blocked-account",
    tenant,
    blockedInCluster: true,
  });
  await em.persistAndFlush([
    user,
    account,
    new UserAccount({ account, user, role: UserRole.OWNER, blockedInCluster: UserStatus.UNBLOCKED }),
    new SystemState(
      SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE,
      storageQuotaOperations.ACCOUNT_QUOTA_STATE.ENABLED,
    ),
  ]);
  const blockAccountStorageQuotas = jest
    .spyOn(storageQuotaOperations, "blockAccountStorageQuotas")
    .mockResolvedValue(undefined);
  const groupService = {
    listUserGroups: jest.fn().mockResolvedValue([{ name: user.userId, gid: undefined }]),
    getUserPrimaryGroup: jest.fn().mockResolvedValue(user.userId),
  };
  const getGroupService = jest
    .spyOn(directoryGroupOperations, "getGroupService")
    .mockResolvedValue(groupService as any);

  try {
    await asyncClientCall(client, "importUsers", {
      data: {
        accounts: [{
          accountName: account.accountName,
          users: [{ userId: user.userId, userName: user.name, blocked: false }],
          owner: user.userId,
          blocked: true,
        }],
      },
      whitelist: false,
    });

    expect(blockAccountStorageQuotas).toHaveBeenCalledTimes(1);
    expect(blockAccountStorageQuotas).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountName: account.accountName, blockedInCluster: true }),
      expect.anything(),
    );
  } finally {
    blockAccountStorageQuotas.mockRestore();
    getGroupService.mockRestore();
  }
});

describe("resource management", () => {
  let originalScowResource: typeof commonConfig.scowResource;
  let unblockAccount: jest.SpyInstance;

  beforeEach(() => {
    originalScowResource = commonConfig.scowResource;
    commonConfig.scowResource = { address: "http://localhost:1" };
    // 只验证导入流程会派发分区收敛，不在该测试中连接真实的 resource 服务和调度器适配器。
    unblockAccount = jest.spyOn(blockOperations, "unblockAccount").mockResolvedValue("ALREADY_UNBLOCKED");
  });

  afterEach(() => {
    commonConfig.scowResource = originalScowResource;
    unblockAccount.mockRestore();
  });

  it("reconciles assigned partitions when importing an unblocked account", async () => {
    const em = orm.em.fork();
    const tenant = await em.findOneOrFail(Tenant, { name: "default" });
    tenant.defaultAccountBlockThreshold = new Decimal(-1);
    const account = new Account({
      accountName: "unblocked_account",
      comment: "",
      blockedInCluster: false,
      tenant,
    });
    await em.persistAndFlush([tenant, account]);

    await asyncClientCall(client, "importUsers", {
      data: {
        accounts: [
          {
            accountName: account.accountName,
            users: [{ userId: "new_user", userName: "New User", blocked: false }],
            blocked: false,
          },
        ],
      },
      whitelist: false,
    });

    expect(unblockAccount).toHaveBeenCalledTimes(1);
    expect(unblockAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountName: account.accountName, blockedInCluster: false }),
      expect.any(Object),
      server.ext.clusters,
      expect.any(Object),
      server.ext.resource,
      expect.any(Object),
      true,
    );
  });
});
