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

/* eslint-disable max-len */
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { MikroORM } from "@mikro-orm/core";
import { MySqlDriver } from "@mikro-orm/mysql";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { createServer } from "src/app";
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
      users: [{ userId: "user1", userName: "user1Name", blocked: false }, { userId: "user2", userName: "user2", blocked: true }],
      owner: "user1",
      blocked: false,
    },
    {
      accountName: "account2",
      users: [{ userId: "user2", userName: "user2", blocked: false }, { userId: "user3", userName: "user3", blocked: true }],
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

  const ua = await em.find(UserAccount, { }, {
    populate: ["account", "user"],
  });
  expect(ua.map((x) => ({
    accountName: x.account.$.accountName,
    userId: x.user.$.userId,
    role: x.role,
    blocked: x.blockedInCluster === UserStatus.BLOCKED,
  })))
    .toIncludeSameMembers([
      { accountName: "a_user1", userId: "user1", role: UserRole.OWNER, blocked: false },
      { accountName: "a_user1", userId: "user2", role: UserRole.USER, blocked: true },
      { accountName: "account2", userId: "user2", role: UserRole.OWNER, blocked: false },
      { accountName: "account2", userId: "user3", role: UserRole.USER, blocked: true },
    ]);

  const users = await em.find(User, { });
  expect(users.map((x) => ({ userId: x.userId, name: x.name })))
    .toIncludeSameMembers([
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

  await asyncClientCall(client, "importUsers", { data: data, whitelist: true })
    .catch((e) =>
    { console.log(e);
      expect(e.code).toBe(Status.INVALID_ARGUMENT); });

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
    tenant });
  await em.persistAndFlush([user, account]);

  await asyncClientCall(client, "importUsers", { data: data, whitelist: true });

  const accounts = await em.find(Account, {});
  expect(accounts.map((x) => x.accountName)).toIncludeSameMembers(data.accounts.map((x) => x.accountName));

  const ua = await em.find(UserAccount, { }, {
    populate: ["account", "user"],
  });
  expect(ua.map((x) => ({
    accountName: x.account.$.accountName,
    userId: x.user.$.userId,
    role: x.role,
    blocked: x.blockedInCluster === UserStatus.BLOCKED,
  })))
    .toIncludeSameMembers([
      { accountName: "a_user1", userId: "user1", role: UserRole.OWNER, blocked: false },
      { accountName: "a_user1", userId: "user2", role: UserRole.USER, blocked: true },
      { accountName: "account2", userId: "user2", role: UserRole.OWNER, blocked: false },
      { accountName: "account2", userId: "user3", role: UserRole.USER, blocked: true },
    ]);

  const users = await em.find(User, { });
  expect(users.map((x) => ({ userId: x.userId, name: x.name })))
    .toIncludeSameMembers([
      { userId: "user1", name: "user1Name" },
      { userId: "user2", name: "user2" },
      { userId: "user3", name: "user3" },
    ]);
});
