/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { Loaded } from "@mikro-orm/core";
import { createUser } from "@scow/lib-auth";
import { dayjsToDateMessage } from "@scow/lib-server/build/date";
import { AccountUserInfo_DisplayedUserState as DisplayedUserState,
  AccountUserInfo_UserStateInAccount as UserStateInAccount,
  GetAllUsersRequest_UsersSortField, PlatformRole, platformRoleFromJSON,
  SortDirection, TenantRole, UserRole as UserRoleProtoType, UserServiceClient,
  UserStatus as UserStatusProtoType } from "@scow/protos/build/server/user";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { createServer } from "src/app";
import { authUrl } from "src/config";
import { Account } from "src/entities/Account";
import { Tenant } from "src/entities/Tenant";
import { PlatformRole as pRole, TenantRole as tRole, User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { range } from "src/utils/array";
import { DEFAULT_TENANT_NAME } from "src/utils/constants";
import { reloadEntity } from "src/utils/orm";
import { insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

dayjs.extend(utc);

const anotherTenant = "anotherTenant";

let server: Server;
let client: UserServiceClient;

let tenant: Tenant;

const password = "test";

beforeEach(async () => {
  server = await createServer();
  await server.start();

  tenant = new Tenant({ name: anotherTenant });

  await server.ext.orm.em.fork().persistAndFlush(tenant);

  client = new UserServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("creates user", async () => {

  const name = "123";
  const userId = "2";
  const email = "test@test.com";

  await asyncClientCall(client, "createUser", { name, identityId: userId, email, tenantName: tenant.name, password });

  const em = server.ext.orm.em.fork();

  const user = await em.findOneOrFail(User, { userId });

  expect(user.name).toBe(name);

  expect(createUser).toHaveBeenNthCalledWith(
    1,
    authUrl,
    {
      identityId: userId,
      id: user.id,
      mail: email,
      name: name,
      password,
    },
    expect.anything(),
  );
});

it("add user only in database", async () => {

  const name = "123";
  const userId = "2";
  const email = "test@test.com";

  await asyncClientCall(client, "addUser",
    { name, identityId: userId, email, tenantName: tenant.name });

  const em = server.ext.orm.em.fork();

  const user = await em.findOneOrFail(User, { userId });

  expect(user.name).toBe(name);

});

it("cannot create user if userId exists", async () => {
  const name = "123";
  const userId = "2";
  const email = "test@test.com";

  const user = new User({ name, userId, email, tenant });
  await server.ext.orm.em.fork().persistAndFlush(user);

  const reply = await asyncClientCall(client, "createUser", {
    name, identityId: userId, email, tenantName: tenant.name, password,
  }).catch((e) => e);
  expect(reply.code).toBe(Status.ALREADY_EXISTS);
});

it("cannot remove owner from account", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());

  const reply = await asyncClientCall(client, "removeUserFromAccount", {
    tenantName: data.tenant.name,
    accountName: data.accountA.accountName,
    userId: data.userA.userId,
  }).catch((e) => e);

  expect(reply.code).toBe(Status.OUT_OF_RANGE);
});

it("cannot remove a user from account,when user has jobs running or pending", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());

  const reply = await asyncClientCall(client, "removeUserFromAccount", {
    tenantName: data.tenant.name,
    accountName: data.accountA.accountName,
    userId: data.userB.userId,
  }).catch((e) => e);

  expect(reply.code).toBe(Status.FAILED_PRECONDITION);
});

it("when removing a user from an account, the account and user cannot be deleted", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());
  const em = server.ext.orm.em.fork();

  const account = new Account({
    accountName: "account_remove",
    comment: "",
    blockedInCluster: false,
    tenant:data.tenant,
  }) as Loaded<Account, "tenant">;

  const uaA = new UserAccount({
    account,
    user: data.userA,
    role: UserRole.OWNER,
    blockedInCluster: UserStatus.UNBLOCKED,
  }) as Loaded<UserAccount, "account" | "user">;

  const uaB = new UserAccount({
    account,
    user: data.userB,
    role: UserRole.USER,
    blockedInCluster: UserStatus.UNBLOCKED,
  }) as Loaded<UserAccount, "account" | "user">;

  await em.persistAndFlush([account, uaA, uaB]);

  await asyncClientCall(client, "removeUserFromAccount", {
    tenantName: data.tenant.name,
    accountName: account.accountName,
    userId: data.userB.userId,
  });

  const accountA = await em.findOneOrFail(Account, { id:account.id });
  const userB = await em.findOneOrFail(User, { id:data.userB.id });

  expect(accountA).toBeTruthy();
  expect(userB).toBeTruthy();
});

it("deletes user", async () => {
  const em = server.ext.orm.em.fork();
  const data = await insertInitialData(em);

  const user = new User({
    name: "test", userId: "test", email: "test@test.com",
    tenant: data.tenant,
  });
  data.accountA.users.add(new UserAccount({
    user,
    account: data.accountA,
    role: UserRole.USER,
    blockedInCluster: UserStatus.BLOCKED,
  }));

  await em.persistAndFlush([user]);

  em.clear();

  expect(await em.count(UserAccount, { account: data.accountA })).toBe(3);
  expect(await em.count(User, { tenant: data.tenant })).toBe(3);

  await asyncClientCall(client, "deleteUser", {
    tenantName: user.tenant.getProperty("name"),
    userId: user.userId,
  });

  await reloadEntity(em, data.accountA);

  expect(await em.count(UserAccount, { account: data.accountA })).toBe(2);
  expect(await em.count(User, { tenant: data.tenant })).toBe(2);
});

it("cannot delete owner", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());

  const reply = await asyncClientCall(client, "deleteUser", {
    tenantName: data.tenant.name,
    userId: data.userA.userId,
  }).catch((e) => e);

  expect(reply.code).toBe(Status.FAILED_PRECONDITION);

  expect(await server.ext.orm.em.count(UserAccount, { account: data.accountA })).toBe(2);
  expect(await server.ext.orm.em.count(User, { tenant: data.tenant })).toBe(2);
});


it("get all users", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());

  const users = await asyncClientCall(client, "getAllUsers", {
    page: 1,
    pageSize: 10,
  });

  expect(users.totalCount).toBe(3);
  expect(users.platformUsers.map((x) => ({
    userId: x.userId,
    name: x.name,
    availableAccounts: x.availableAccounts,
    tenantName: x.tenantName,
    createTime: x.createTime,
    platformRoles: x.platformRoles,
  }))).toIncludeSameMembers([
    {
      userId: data.userA.userId,
      name: data.userA.name,
      availableAccounts: [data.accountA.accountName],
      tenantName: data.userA.tenant.getProperty("name"),
      createTime: data.userA.createTime.toISOString(),
      platformRoles: data.userA.platformRoles,
    },
    {
      userId: data.userB.userId,
      name: data.userB.name,
      availableAccounts: expect.toIncludeSameMembers([data.accountA.accountName, data.accountB.accountName]),
      tenantName: data.userB.tenant.getProperty("name"),
      createTime: data.userB.createTime.toISOString(),
      platformRoles: data.userB.platformRoles,
    },
    {
      userId: data.userC.userId,
      name: data.userC.name,
      availableAccounts: [],
      tenantName: data.userC.tenant.getProperty("name"),
      createTime: data.userC.createTime.toISOString(),
      platformRoles: data.userC.platformRoles,
    },
  ]);
});

it("get all users with idOrName", async () => {
  const em = server.ext.orm.em.fork();
  const data = await insertInitialData(em);

  // insert a user for fuzzy search in ids
  const user = new User({
    name: "test", userId: "aa", email: "test@test.com",
    tenant: data.tenant,
  });
  data.accountA.users.add(new UserAccount({
    user,
    account: data.accountA,
    role: UserRole.USER,
    blockedInCluster: UserStatus.BLOCKED,
  }));

  await em.persistAndFlush([user]);
  em.clear();

  // with id
  const users1 = await asyncClientCall(client, "getAllUsers", {
    page:1,
    pageSize:10,
    idOrName: "c",
  });

  expect(users1.totalCount).toBe(1);
  expect(users1.platformUsers.map((x) => ({
    userId: x.userId,
    name: x.name,
    availableAccounts: x.availableAccounts,
    tenantName: x.tenantName,
    createTime: x.createTime,
    platformRoles: x.platformRoles,
  }))).toIncludeSameMembers([
    {
      userId: data.userC.userId,
      name: data.userC.name,
      availableAccounts: [],
      tenantName: data.userC.tenant.getProperty("name"),
      createTime: data.userC.createTime.toISOString(),
      platformRoles: data.userC.platformRoles,
    },
  ]);

  // with name
  const users2 = await asyncClientCall(client, "getAllUsers", {
    page:1,
    pageSize:10,
    idOrName: "BName",
  });

  expect(users2.totalCount).toBe(1);
  expect(users2.platformUsers.map((x) => ({
    userId: x.userId,
    name: x.name,
    availableAccounts: x.availableAccounts,
    tenantName: x.tenantName,
    createTime: x.createTime,
    platformRoles: x.platformRoles,
  }))).toIncludeSameMembers([
    {
      userId: data.userB.userId,
      name: data.userB.name,
      availableAccounts: expect.toIncludeSameMembers([data.accountA.accountName, data.accountB.accountName]),
      tenantName: data.userB.tenant.getProperty("name"),
      createTime: data.userB.createTime.toISOString(),
      platformRoles: data.userB.platformRoles,
    },
  ]);

  // with id Or name
  const users3 = await asyncClientCall(client, "getAllUsers", {
    page:1,
    pageSize:10,
    idOrName: "A",
  });

  expect(users3.totalCount).toBe(4);
  expect(users3.platformUsers.map((x) => ({
    userId: x.userId,
    name: x.name,
    availableAccounts: x.availableAccounts,
    tenantName: x.tenantName,
    createTime: x.createTime,
    platformRoles: x.platformRoles,
  }))).toIncludeSameMembers([
    {
      userId: data.userA.userId,
      name: data.userA.name,
      availableAccounts: [data.accountA.accountName],
      tenantName: data.userA.tenant.getProperty("name"),
      createTime: data.userA.createTime.toISOString(),
      platformRoles: data.userA.platformRoles,
    },
    {
      userId: data.userB.userId,
      name: data.userB.name,
      availableAccounts: expect.toIncludeSameMembers([data.accountA.accountName, data.accountB.accountName]),
      tenantName: data.userB.tenant.getProperty("name"),
      createTime: data.userB.createTime.toISOString(),
      platformRoles: data.userB.platformRoles,
    },
    {
      userId: data.userC.userId,
      name: data.userC.name,
      availableAccounts: [],
      tenantName: data.userC.tenant.getProperty("name"),
      createTime: data.userC.createTime.toISOString(),
      platformRoles: data.userC.platformRoles,
    },
    {
      userId: user.userId,
      name: user.name,
      availableAccounts: [],
      tenantName: user.tenant.getProperty("name"),
      createTime: user.createTime.toISOString(),
      platformRoles: user.platformRoles,
    },
  ]);
});

it("get all users with sorter", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());

  const users = await asyncClientCall(client, "getAllUsers", {
    page: 1,
    pageSize: 10,
    sortField: GetAllUsersRequest_UsersSortField.USER_ID,
    sortOrder: SortDirection.DESC,
  });

  expect(users.totalCount).toBe(3);
  expect(users.platformUsers.map((x) => ({
    userId: x.userId,
    name: x.name,
    availableAccounts: x.availableAccounts,
    tenantName: x.tenantName,
    createTime: x.createTime,
    platformRoles: x.platformRoles,
  }))).toIncludeSameMembers([
    {
      userId: data.userC.userId,
      name: data.userC.name,
      availableAccounts: [],
      tenantName: data.userC.tenant.getProperty("name"),
      createTime: data.userC.createTime.toISOString(),
      platformRoles: data.userC.platformRoles,
    },
    {
      userId: data.userB.userId,
      name: data.userB.name,
      availableAccounts: expect.toIncludeSameMembers([data.accountA.accountName, data.accountB.accountName]),
      tenantName: data.userB.tenant.getProperty("name"),
      createTime: data.userB.createTime.toISOString(),
      platformRoles: data.userB.platformRoles,
    },
    {
      userId: data.userA.userId,
      name: data.userA.name,
      availableAccounts: [data.accountA.accountName],
      tenantName: data.userA.tenant.getProperty("name"),
      createTime: data.userA.createTime.toISOString(),
      platformRoles: data.userA.platformRoles,
    },
  ]);
});

it("get all users with platform role", async () => {
  const em = server.ext.orm.em.fork();
  const data = await insertInitialData(em);

  await asyncClientCall(client, "setPlatformRole", {
    userId: data.userA.userId,
    roleType: PlatformRole.PLATFORM_ADMIN,
  });

  const users = await asyncClientCall(client, "getAllUsers", {
    page: 1,
    pageSize: 10,
    platformRole: PlatformRole.PLATFORM_ADMIN,
  });

  expect(users.totalCount).toBe(1);
  expect(users.platformUsers.map((x) => ({
    userId: x.userId,
    name: x.name,
    availableAccounts: x.availableAccounts,
    tenantName: x.tenantName,
    createTime: x.createTime,
    platformRoles: x.platformRoles,
  }))).toIncludeSameMembers([
    {
      userId: data.userA.userId,
      name: data.userA.name,
      availableAccounts: [data.accountA.accountName],
      tenantName: data.userA.tenant.getProperty("name"),
      createTime: data.userA.createTime.toISOString(),
      platformRoles: [platformRoleFromJSON(PlatformRole.PLATFORM_ADMIN)],
    },
  ]);

  await asyncClientCall(client, "unsetPlatformRole", {
    userId: data.userA.userId,
    roleType: PlatformRole.PLATFORM_ADMIN,
  });

  em.clear();
});

it("manage platform role", async () => {
  const em = server.ext.orm.em.fork();
  const data = await insertInitialData(em);

  await asyncClientCall(client, "setPlatformRole", {
    userId: data.userA.userId,
    roleType: PlatformRole.PLATFORM_ADMIN,
  });

  const setUser = await em.findOne(User, { userId: data.userA.userId });
  expect(setUser?.platformRoles.includes(pRole["PLATFORM_ADMIN"])).toBe(true);

  await asyncClientCall(client, "unsetPlatformRole", {
    userId: data.userA.userId,
    roleType: PlatformRole.PLATFORM_ADMIN,
  });

  const unsetUser = await em.findOne(User, { userId: data.userA.userId });
  expect(unsetUser?.platformRoles.includes(pRole["PLATFORM_ADMIN"])).toBe(false);
});

it("manage tenant role", async () => {
  const em = server.ext.orm.em.fork();
  const data = await insertInitialData(em);

  await asyncClientCall(client, "setTenantRole", {
    userId: data.userA.userId,
    roleType: TenantRole.TENANT_FINANCE,
  });

  const setUser = await em.findOne(User, { userId: data.userA.userId });
  expect(setUser?.tenantRoles.includes(tRole["TENANT_FINANCE"])).toBe(true);

  await asyncClientCall(client, "unsetTenantRole", {
    userId: data.userA.userId,
    roleType: TenantRole.TENANT_ADMIN,
  });

  const unsetUser = await em.findOne(User, { userId: data.userA.userId });
  expect(unsetUser?.tenantRoles.includes(tRole["TENANT_ADMIN"])).toBe(false);
});

it("get platform role users Count", async () => {

  const em = server.ext.orm.em.fork();
  const data = await insertInitialData(em);

  await asyncClientCall(client, "setPlatformRole", {
    userId: data.userA.userId,
    roleType: PlatformRole.PLATFORM_ADMIN,
  });
  await asyncClientCall(client, "setPlatformRole", {
    userId: data.userB.userId,
    roleType: PlatformRole.PLATFORM_FINANCE,
  });

  const counts = await asyncClientCall(client, "getPlatformUsersCounts", {
  });

  expect(counts.totalCount).toBe(3);
  expect(counts.totalAdminCount).toBe(1);
  expect(counts.totalFinanceCount).toBe(1);
});

it("change user email", async () => {
  const name = "test";
  const userId = "test";
  const email = "test@test.com";
  const newEmail = "test@123.com";

  const user = new User({ name, userId, email, tenant });
  await server.ext.orm.em.fork().persistAndFlush(user);

  await asyncClientCall(client, "changeEmail", {
    userId: "test",
    newEmail:newEmail,
  });
  const em = server.ext.orm.em.fork();

  const newUser = await em.findOne(User, { userId: "test" });
  expect(newUser?.email).toBe(newEmail);
});

it("change an inexistent user email", async () => {
  const newEmail = "test@123.com";

  const reply = await asyncClientCall(client, "changeEmail", {
    userId: "test",
    newEmail:newEmail,
  }).catch((e) => e);

  expect(reply.code).toBe(Status.NOT_FOUND);
});

it("get new user count in UTC+8 timezone", async () => {

  const em = server.ext.orm.em.fork();
  const today = dayjs();
  const yesterday = today.clone().subtract(1, "day");
  const twoDaysBefore = today.clone().subtract(2, "day");
  const tenant = await em.findOneOrFail(Tenant, { name: DEFAULT_TENANT_NAME });

  const todayNewUsers = range(0, 30).map((i) => new User({
    name: `user0${i}`,
    userId: `user0${i}`,
    email: `user0${i}@gmail.com`,
    tenant,
    createTime: today.toDate(),
  }));

  const yesterdayNewUsers = range(0, 20).map((i) => new User({
    name: `user1${i}`,
    userId: `user1${i}`,
    email: `user1${i}@gmail.com`,
    tenant,
    createTime: yesterday.toDate(),
  }));

  const twoDaysBeforeNewUsers = range(0, 10).map((i) => new User({
    name: `user2${i}`,
    userId: `user2${i}`,
    email: `user2${i}@gmail.com`,
    tenant,
    createTime: twoDaysBefore.toDate(),
  }));

  await em.persistAndFlush([
    ...todayNewUsers,
    ...yesterdayNewUsers,
    ...twoDaysBeforeNewUsers,
  ]);

  const info = await asyncClientCall(client, "getNewUserCount", {
    startTime: twoDaysBefore.startOf("day").toISOString(),
    endTime: today.endOf("day").toISOString(),
    timeZone: "Asia/Shanghai",
  });

  const todyInUtcPlus8 = today.utcOffset(8);

  const yesterdayInUtcPlus8 = yesterday.utcOffset(8);

  const twoDaysBeforeInUtcPlus8 = twoDaysBefore.utcOffset(8);

  expect(info.results).toMatchObject([
    { date: dayjsToDateMessage(todyInUtcPlus8), count: 30 },
    { date:dayjsToDateMessage(yesterdayInUtcPlus8), count: 20 },
    { date:dayjsToDateMessage(twoDaysBeforeInUtcPlus8), count: 10 },
  ]);

});

it("get account users", async () => {
  const data = await insertInitialData(server.ext.orm.em.fork());

  const reply = await asyncClientCall(client, "getAccountUsers", {
    tenantName: data.tenant.name,
    accountName: data.accountA.accountName,
  }).catch((e) => e);

  expect(reply.results).toIncludeSameMembers([
    {
      userId: "a",
      name: "AName",
      email: "a@a.com",
      role: UserRoleProtoType.OWNER,
      status: UserStatusProtoType.UNBLOCKED,
      jobChargeLimit: undefined,
      usedJobChargeLimit: undefined,
      storageQuotas: {},
      userStateInAccount: UserStateInAccount.NORMAL,
      displayedUserState: DisplayedUserState.DISPLAYED_NORMAL,
    },
    {
      userId: "b",
      name: "BName",
      email: "b@b.com",
      role: UserRoleProtoType.ADMIN,
      status: UserStatusProtoType.UNBLOCKED,
      jobChargeLimit: undefined,
      usedJobChargeLimit: undefined,
      storageQuotas: {},
      userStateInAccount: UserStateInAccount.NORMAL,
      displayedUserState: DisplayedUserState.DISPLAYED_NORMAL,
    },
  ]);
});
