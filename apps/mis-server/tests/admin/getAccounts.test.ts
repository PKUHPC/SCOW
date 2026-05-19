import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { decimalToMoney } from "@scow/lib-decimal";
import {
  Account_AccountState as AccountState,
  Account_DisplayedAccountState as DisplayedAccountState,
  AccountServiceClient,
} from "@scow/protos/build/server/account";
import { createServer } from "src/app";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let data: InitialData;

beforeEach(async () => {
  server = await createServer();

  const em = server.ext.orm.em.fork();

  data = await insertInitialData(em);

  await server.start();
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("gets all accounts", async () => {
  const client = new AccountServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const resp = await asyncClientCall(client, "getAccounts", {
    tenantName: data.tenant.name,
  });

  expect(resp.results).toIncludeSameMembers([
    {
      accountName: "hpca",
      blocked: false,
      ownerId: "a",
      ownerName: "AName",
      userCount: 2,
      comment: "",
      tenantName: data.tenant.name,
      balance: decimalToMoney(data.accountA.balance),
      blockThresholdAmount: data.accountA.blockThresholdAmount
        ? decimalToMoney(data.accountA.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountA.tenant.$.defaultAccountBlockThreshold),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
    {
      accountName: "hpcb",
      blocked: false,
      ownerId: "b",
      ownerName: "BName",
      userCount: 1,
      tenantName: data.tenant.name,
      comment: "",
      balance: decimalToMoney(data.accountB.balance),
      blockThresholdAmount: data.accountB.blockThresholdAmount
        ? decimalToMoney(data.accountB.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountB.tenant.$.defaultAccountBlockThreshold),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
  ]);
});

it("account does not have an owner", async () => {
  const client = new AccountServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const reply = await asyncClientCall(client, "getAccounts", {});

  // 兼容不存在拥有者的情况
  expect(reply.results).toIncludeSameMembers([
    {
      accountName: "hpca",
      blocked: false,
      ownerId: "a",
      ownerName: "AName",
      userCount: 2,
      comment: "",
      tenantName: data.tenant.name,
      balance: decimalToMoney(data.accountA.balance),
      blockThresholdAmount: data.accountA.blockThresholdAmount
        ? decimalToMoney(data.accountA.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountA.tenant.$.defaultAccountBlockThreshold),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
    {
      accountName: "hpcb",
      blocked: false,
      ownerId: "b",
      ownerName: "BName",
      userCount: 1,
      tenantName: data.tenant.name,
      comment: "",
      balance: decimalToMoney(data.accountB.balance),
      blockThresholdAmount: data.accountB.blockThresholdAmount
        ? decimalToMoney(data.accountB.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountB.tenant.$.defaultAccountBlockThreshold),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
    {
      accountName: "hpcc",
      blocked: false,
      isInWhitelist: false,
      ownerId: undefined,
      ownerName: undefined,
      userCount: 1,
      comment: "123",
      tenantName: data.anotherTenant.name,
      state: AccountState.NORMAL,
      blockThresholdAmount: data.accountC.blockThresholdAmount
        ? decimalToMoney(data.accountC.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountC.tenant.getProperty("defaultAccountBlockThreshold")),
      balance: decimalToMoney(data.accountC.balance),
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
  ]);
});

it("gets all accounts", async () => {
  const client = new AccountServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  const em = server.ext.orm.em.fork();
  const anotherTenant = (await em.findOne(Tenant, { name: "another" })) as Tenant;
  const userD = new User({ tenant: anotherTenant, email: "123", name: "dName", userId: "d" });
  const accountC = (await em.findOne(Account, { accountName: "hpcc" })) as Account;
  const uaCD = new UserAccount({
    user: userD,
    account: accountC,
    role: UserRole.OWNER,
    blockedInCluster: UserStatus.BLOCKED,
  });
  await em.persistAndFlush([userD, uaCD]);

  const resp = await asyncClientCall(client, "getAccounts", {});

  expect(resp.results).toIncludeSameMembers([
    {
      accountName: "hpca",
      blocked: false,
      ownerId: "a",
      ownerName: "AName",
      userCount: 2,
      comment: "",
      tenantName: data.tenant.name,
      balance: decimalToMoney(data.accountA.balance),
      blockThresholdAmount: data.accountA.blockThresholdAmount
        ? decimalToMoney(data.accountA.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountA.tenant.$.defaultAccountBlockThreshold),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
    {
      accountName: "hpcb",
      blocked: false,
      ownerId: "b",
      ownerName: "BName",
      userCount: 1,
      tenantName: data.tenant.name,
      comment: "",
      balance: decimalToMoney(data.accountB.balance),
      blockThresholdAmount: data.accountB.blockThresholdAmount
        ? decimalToMoney(data.accountB.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountB.tenant.$.defaultAccountBlockThreshold),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
    {
      accountName: "hpcc",
      blocked: false,
      ownerId: "d",
      ownerName: "dName",
      userCount: 2,
      tenantName: data.anotherTenant.name,
      comment: "123",
      balance: decimalToMoney(data.accountC.balance),
      blockThresholdAmount: data.accountC.blockThresholdAmount
        ? decimalToMoney(data.accountC.blockThresholdAmount)
        : undefined,
      defaultBlockThresholdAmount: decimalToMoney(data.accountC.tenant.getProperty("defaultAccountBlockThreshold")),
      state: AccountState.NORMAL,
      isInWhitelist: false,
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
    },
  ]);
});
