import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { AdminServiceClient, GetAdminInfoResponse } from "@scow/protos/build/server/admin";
import dayjs from "dayjs";
import { createServer } from "src/app";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { PlatformRole, User } from "src/entities/User";
import { range } from "src/utils/array";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient } from "tests/utils";

let server: Server;
let em: SqlEntityManager;
let client: AdminServiceClient;

beforeEach(async () => {
  server = await createServer();
  await server.start();

  client = createTestClient(server.serverAddress, AdminServiceClient);
  em = server.ext.orm.em.fork();
  await insertInitialData(em);
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("get admin info", async () => {
  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });
  const adminUser = new User({
    name: "admin",
    userId: "admin_user",
    email: "admin@admin.com",
    tenant,
    platformRoles: [PlatformRole.PLATFORM_ADMIN],
  });
  const financeUser = new User({
    name: "finance",
    userId: "finance_user",
    email: "finance@finance.com",
    tenant,
    platformRoles: [PlatformRole.PLATFORM_FINANCE],
  });
  await em.persistAndFlush([adminUser, financeUser]);

  const info = await asyncClientCall(client, "getAdminInfo", {});

  expect(info).toEqual({
    platformAdmins: [adminUser].map((x) => ({ userId: x.userId, userName: x.name })),
    platformFinancialStaff: [financeUser].map((x) => ({ userId: x.userId, userName: x.name })),
    tenantCount: 2,
    accountCount: 3,
    userCount: 5,
  } as GetAdminInfoResponse);
});

it("get statistic info", async () => {
  const today = dayjs();
  const yesterDay = today.clone().subtract(1, "day");

  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });

  const todayNewUsers = range(0, 10).map(
    (i) =>
      new User({
        name: `user0${i}`,
        userId: `user0${i}`,
        email: `user0${i}@gmail.com`,
        tenant,
        createTime: today.toDate(),
      }),
  );

  const yesterdayNewUsers = range(0, 10).map(
    (i) =>
      new User({
        name: `user1${i}`,
        userId: `user1${i}`,
        email: `user1${i}@gmail.com`,
        tenant,
        createTime: yesterDay.toDate(),
      }),
  );

  const todayNewAccount = range(0, 5).map(
    (i) =>
      new Account({
        accountName: `account0${i}`,
        tenant,
        blockedInCluster: false,
        createTime: today.toDate(),
      }),
  );

  const yesterdayNewAccount = range(0, 5).map(
    (i) =>
      new Account({
        accountName: `account1${i}`,
        tenant,
        blockedInCluster: false,
        createTime: yesterDay.toDate(),
      }),
  );

  const todayNewTenant = range(0, 20).map(
    (i) =>
      new Tenant({
        name: `tenant0${i}`,
        createTime: today.toDate(),
      }),
  );

  const yesterdayNewTenant = range(0, 20).map(
    (i) =>
      new Tenant({
        name: `tenant1${i}`,
        createTime: yesterDay.toDate(),
      }),
  );

  await em.persistAndFlush([
    ...todayNewUsers,
    ...yesterdayNewUsers,
    ...todayNewAccount,
    ...yesterdayNewAccount,
    ...todayNewTenant,
    ...yesterdayNewTenant,
  ]);

  const info = await asyncClientCall(client, "getStatisticInfo", {
    startTime: today.startOf("day").toISOString(),
    endTime: today.endOf("day").toISOString(),
  });

  // 新添加的10 user + 5 account + 20 tenant 以及initial data中的3 user, 3 account, 2 tenant
  expect(info).toEqual({
    newUser: 13,
    newAccount: 8,
    newTenant: 22,
    totalUser: 23,
    totalAccount: 13,
    totalTenant: 42,
    refreshTime: expect.any(String), // 允许任意时间字符串
  });
});
