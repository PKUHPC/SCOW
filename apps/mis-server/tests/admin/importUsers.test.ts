import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { MikroORM } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { Decimal } from "@scow/lib-decimal";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { createServer } from "src/app";
import * as blockOperations from "src/bl/block";
import { commonConfig } from "src/config/common";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let orm: MikroORM<MySqlDriver>;
let client: AdminServiceClient;

beforeEach(async () => {
  server = await createServer();
  await server.start();

  client = new AdminServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

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

describe("resource management", () => {
  let originalScowResource: typeof commonConfig.scowResource;
  let unblockAccount: jest.SpyInstance;

  beforeEach(() => {
    originalScowResource = commonConfig.scowResource;
    commonConfig.scowResource = { enabled: true, address: "http://localhost:1" };
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
    );
  });
});
