import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { Decimal } from "@scow/lib-decimal";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { createServer } from "src/app";
import { Account, AccountState } from "src/entities/Account";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient, mockAccountResourceOperations } from "tests/utils";

let server: Server;
let client: AccountServiceClient;
let tenant: Tenant;
let user: User;

beforeEach(async () => {
  server = await createServer();
  mockAccountResourceOperations(server.ext.resource);
  await server.start();
  // await server.ext.orm.em.fork().persistAndFlush(account);

  tenant = new Tenant({ name: "tenant" });
  await server.ext.orm.em.fork().persistAndFlush(tenant);

  user = new User({ name: "test", userId: "test", tenant: tenant, email: "test@test.com" });
  await server.ext.orm.em.fork().persistAndFlush(user);

  client = createTestClient(server.serverAddress, AccountServiceClient);
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("create a new account", async () => {
  await asyncClientCall(client, "createAccount", {
    accountName: "a1234",
    tenantName: tenant.name,
    ownerId: user.userId,
  });
  const em = server.ext.orm.em.fork();

  const account = await em.findOneOrFail(Account, { accountName: "a1234" });
  expect(account.accountName).toBe("a1234");
});

it("cannot create a account if the name exists", async () => {
  const account = new Account({
    accountName: "123",
    tenant,
    blockedInCluster: false,
    comment: "test",
  });
  await server.ext.orm.em.fork().persistAndFlush(account);

  const reply = await asyncClientCall(client, "createAccount", {
    accountName: "123",
    tenantName: "tenant",
    ownerId: user.userId,
  }).catch((e) => e);
  expect(reply.code).toBe(Status.ALREADY_EXISTS);
});

it("cannot block or unblock an account through another tenant", async () => {
  const em = server.ext.orm.em.fork();
  const anotherTenant = new Tenant({ name: "anotherTenant" });
  const account = new Account({
    accountName: "crossTenantAccount",
    tenant,
    blockedInCluster: false,
    comment: "test",
  });
  await em.persistAndFlush([anotherTenant, account]);

  const blockReply = await asyncClientCall(client, "blockAccount", {
    accountName: account.accountName,
    tenantName: anotherTenant.name,
  }).catch((e) => e);
  expect(blockReply.code).toBe(Status.NOT_FOUND);

  account.blockedInCluster = true;
  await em.flush();

  const unblockReply = await asyncClientCall(client, "unblockAccount", {
    accountName: account.accountName,
    tenantName: anotherTenant.name,
  }).catch((e) => e);
  expect(unblockReply.code).toBe(Status.NOT_FOUND);
});

it("delete account", async () => {
  const em = server.ext.orm.em.fork();

  const userA = new User({
    name: "testA",
    userId: "testA",
    email: "testA@test.com",
    tenant,
  });

  const accountA = new Account({
    accountName: "accountA",
    tenant,
    blockedInCluster: false,
    comment: "test",
  });

  const userAccount = new UserAccount({
    user,
    account: accountA,
    role: UserRole.ADMIN,
    blockedInCluster: UserStatus.UNBLOCKED,
  });

  const userAccountA = new UserAccount({
    user: userA,
    account: accountA,
    role: UserRole.OWNER,
    blockedInCluster: UserStatus.UNBLOCKED,
  });

  const whitelist = new AccountWhitelist({
    account: accountA,
    comment: "",
    operatorId: "123",
    time: new Date("2023-01-01T00:00:00.000Z"),
    expirationTime: new Date("2125-01-01T00:00:00.000Z"),
  });

  await em.persistAndFlush([userA, accountA, userAccount, userAccountA, whitelist]);

  const initialAccountCount = await em.count(UserAccount, { account: accountA });
  expect(initialAccountCount).toBe(2);
  const whitelistedAccount = await asyncClientCall(client, "getWhitelistedAccounts", {
    tenantName: accountA.tenant.getProperty("name"),
  });
  expect(whitelistedAccount.accounts.length).toBe(1);

  // 执行删除账户操作
  await asyncClientCall(client, "deleteAccount", {
    tenantName: accountA.tenant.getProperty("name"),
    accountName: accountA.accountName,
  });

  em.clear();

  // 确认账户被删除
  const remainingUserAccountCount = await em.count(UserAccount, { account: accountA });
  expect(remainingUserAccountCount).toBe(1);

  const updatedAccountA = await em.findOneOrFail(Account, { accountName: "accountA" });
  expect(updatedAccountA.state).toBe(AccountState.DELETED);

  const remainingWhitelistedAccounts = await asyncClientCall(client, "getWhitelistedAccounts", {
    tenantName: accountA.tenant.getProperty("name"),
  });
  expect(remainingWhitelistedAccounts.accounts.length).toBe(0);
});

it("cannot delete account with jobs running", async () => {
  const em = server.ext.orm.em.fork();

  const accountA = new Account({
    accountName: "hpca", // 和测试数据中有的数据保持一致
    tenant,
    blockedInCluster: false,
    comment: "test",
  });

  const userAccount = new UserAccount({
    user,
    account: accountA,
    role: UserRole.OWNER,
    blockedInCluster: UserStatus.UNBLOCKED,
  });

  await em.persistAndFlush([accountA, userAccount]);

  // 假设 accountA 有正在进行的作业，无法删除
  const reply = await asyncClientCall(client, "deleteAccount", {
    tenantName: accountA.tenant.getProperty("name"),
    accountName: accountA.accountName,
  }).catch((e) => e);

  expect(reply.code).toBe(Status.FAILED_PRECONDITION);

  // 确认账户仍然存在
  const updatedAccountA = await em.findOneOrFail(Account, { accountName: "hpca" });
  expect(updatedAccountA.state).toBe(AccountState.NORMAL);
  const remainingUserAccountCount = await em.count(UserAccount, { account: accountA });
  expect(remainingUserAccountCount).toBe(1);
});

it("should check if account is below block threshold", async () => {
  const em = server.ext.orm.em.fork();

  // 创建一个模拟账户
  const accountA = new Account({
    accountName: "testAccountBelowThreshold",
    tenant,
    blockedInCluster: false,
    comment: "test account",
  });

  // 设置账户的余额和阈值
  accountA.balance = new Decimal(50);
  accountA.blockThresholdAmount = new Decimal(100); // 阻止阈值为 100
  await em.persistAndFlush(accountA);

  // 调用 isAccountBelowBlockThreshold 检查账户是否低于阻止阈值
  const result = await asyncClientCall(client, "isAccountBelowBlockThreshold", {
    accountName: "testAccountBelowThreshold",
  });

  // 确认返回值
  expect(result.isBelowBlockThreshold).toBe(true);
});

it("should return false if account is not below block threshold", async () => {
  const em = server.ext.orm.em.fork();

  // 创建一个模拟账户
  const accountA = new Account({
    accountName: "testAccountAboveThreshold",
    tenant,
    blockedInCluster: false,
    comment: "test account",
  });

  // 设置账户的余额和阈值
  accountA.balance = new Decimal(150); // 余额高于阈值
  accountA.blockThresholdAmount = new Decimal(100); // 阻止阈值为 100
  await em.persistAndFlush(accountA);

  // 调用 isAccountBelowBlockThreshold 检查账户是否低于阻止阈值
  const result = await asyncClientCall(client, "isAccountBelowBlockThreshold", {
    accountName: "testAccountAboveThreshold",
  });

  // 确认返回值
  expect(result.isBelowBlockThreshold).toBe(false);
});

it("should throw NOT_FOUND if account does not exist", async () => {
  // 调用 isAccountBelowBlockThreshold 时模拟账户不存在
  const reply = await asyncClientCall(client, "isAccountBelowBlockThreshold", {
    accountName: "nonExistentAccount",
  }).catch((e) => e);

  // 账户不存在时应抛出 NOT_FOUND 错误
  expect(reply.code).toBe(Status.NOT_FOUND);
  expect(reply.message).toBe("5 NOT_FOUND: Account nonExistentAccount is not found");
});
