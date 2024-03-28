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
import { SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal, decimalToMoney } from "@scow/lib-decimal";
import { JobChargeLimitServiceClient } from "@scow/protos/build/server/job_charge_limit";
import { createServer } from "src/app";
import { addJobCharge } from "src/bl/charging";
import { UserAccount, UserStateInAccount, UserStatus } from "src/entities/UserAccount";
import { reloadEntity } from "src/utils/orm";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

let server: Server;
let em: SqlEntityManager;
let client: JobChargeLimitServiceClient;
let data: InitialData;
let ua: Loaded<UserAccount, "user" | "account">;

beforeEach(async () => {
  server = await createServer();
  await server.start();

  client = new JobChargeLimitServiceClient(server.serverAddress, ChannelCredentials.createInsecure());

  em = server.ext.orm.em.fork();

  data = await insertInitialData(em);

  ua = data.uaAA;
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

const params = (ua: UserAccount) => ({
  accountName: ua.account.getEntity().accountName,
  userId: ua.user.getEntity().userId,
  tenantName: data.tenant.name,
});

function expectDecimalEqual(decimal1?: Decimal, decimal2?: Decimal) {
  expect(decimal1?.toNumber()).toBe(decimal2?.toNumber());
}

it("sets job charge limit", async () => {
  const limit = new Decimal(100);

  expect(ua.jobChargeLimit).toBeUndefined();

  await asyncClientCall(client, "setJobChargeLimit", {
    ...params(ua), limit: decimalToMoney(limit),
  });

  await reloadEntity(em, ua);

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expectDecimalEqual(ua.usedJobCharge, new Decimal(0));
});

it("changes job charge limit", async () => {
  const limit = new Decimal(100);

  ua.jobChargeLimit = limit;
  ua.usedJobCharge = new Decimal(0);
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expectDecimalEqual(ua.usedJobCharge, new Decimal(0));

  const newLimit = new Decimal(20);

  await asyncClientCall(client, "setJobChargeLimit", { ...params(ua), limit: decimalToMoney(newLimit) });

  await reloadEntity(em, ua);

  expectDecimalEqual(ua.jobChargeLimit, newLimit);
});

it("cannot change job charge limit when the limit < usedJobCharge", async () => {

  const limit = new Decimal(100);

  ua.jobChargeLimit = limit;
  ua.usedJobCharge = new Decimal(50);
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expectDecimalEqual(ua.usedJobCharge, new Decimal(50));

  const newLimit = new Decimal(20);

  const reply = await asyncClientCall(client, "setJobChargeLimit", {
    ...params(ua), limit: decimalToMoney(newLimit) }).catch((e) => e);

  expect(reply.code).toBe(Status.INVALID_ARGUMENT);
});

it("cancels job charge limit", async () => {
  const limit = new Decimal(100);

  ua.jobChargeLimit = limit;
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);

  await asyncClientCall(client, "cancelJobChargeLimit", { ...params(ua) });

  const ua1 = await em.fork().findOneOrFail(UserAccount, {
    account: ua.account,
    user: ua.user,
  });

  expect(ua1.jobChargeLimit).toBeUndefined();
  expect(ua1.usedJobCharge).toBeUndefined();
});

it("unlocking user while cancels job charge limit and state is NORMAL", async () => {
  const limit = new Decimal(100);

  ua.jobChargeLimit = limit;
  ua.blockedInCluster = UserStatus.BLOCKED;
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expect(ua.state).toEqual(UserStateInAccount.NORMAL);

  await asyncClientCall(client, "cancelJobChargeLimit", { ...params(ua) });

  const ua1 = await em.fork().findOneOrFail(UserAccount, {
    account: ua.account,
    user: ua.user,
  }, { populate: ["user", "account"]});

  expect(ua1.jobChargeLimit).toBeUndefined();
  expect(ua1.usedJobCharge).toBeUndefined();
  expect(ua1.blockedInCluster).toBe(UserStatus.UNBLOCKED);
  expect(ua1.state).toBe(UserStateInAccount.NORMAL);
});

it("still block user while cancels job charge limit and state is BLOCKED_BY_ADMIN", async () => {
  const limit = new Decimal(100);

  ua.jobChargeLimit = limit;
  ua.blockedInCluster = UserStatus.BLOCKED;
  ua.state = UserStateInAccount.BLOCKED_BY_ADMIN;
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expect(ua.state).toEqual(UserStateInAccount.BLOCKED_BY_ADMIN);

  await asyncClientCall(client, "cancelJobChargeLimit", { ...params(ua) });

  const ua1 = await em.fork().findOneOrFail(UserAccount, {
    account: ua.account,
    user: ua.user,
  }, { populate: ["user", "account"]});

  expect(ua1.jobChargeLimit).toBeUndefined();
  expect(ua1.usedJobCharge).toBeUndefined();
  expect(ua1.blockedInCluster).toBe(UserStatus.BLOCKED);
  expect(ua1.state).toBe(UserStateInAccount.BLOCKED_BY_ADMIN);
});

it("adds job charge", async () => {
  const limit = new Decimal(100);
  ua.jobChargeLimit = limit;
  ua.usedJobCharge = new Decimal(0);
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);

  const charge = new Decimal(20.4);

  await addJobCharge(ua, charge, server.ext, server.logger);

  expectDecimalEqual(ua.usedJobCharge, charge);
  expectDecimalEqual(ua.jobChargeLimit, limit);
  expect(ua.blockedInCluster).toBe(UserStatus.UNBLOCKED);
});

it("blocks user if used > limit", async () => {
  const limit = new Decimal(100);
  ua.jobChargeLimit = limit;
  ua.usedJobCharge = new Decimal(0);
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);

  const charge = new Decimal(120.4);
  await addJobCharge(ua, charge, server.ext, server.logger);

  expectDecimalEqual(ua.usedJobCharge, charge);
  expectDecimalEqual(ua.jobChargeLimit, limit);
  expect(ua.blockedInCluster).toBe(UserStatus.BLOCKED);
});

it("blocks user if used = limit", async () => {
  const limit = new Decimal(100);
  ua.jobChargeLimit = limit;
  ua.usedJobCharge = new Decimal(0);
  await em.flush();

  expectDecimalEqual(ua.jobChargeLimit, limit);

  const charge = new Decimal(100);
  await addJobCharge(ua, charge, server.ext, server.logger);

  expectDecimalEqual(ua.usedJobCharge, charge);
  expectDecimalEqual(ua.jobChargeLimit, limit);
  expect(ua.blockedInCluster).toBe(UserStatus.BLOCKED);
});

it("unblocked user if limit is changed to > used", async () => {
  const limit = new Decimal(100);
  ua.jobChargeLimit = limit;
  ua.usedJobCharge = limit.plus(20);
  ua.blockedInCluster = UserStatus.BLOCKED;
  await em.flush();

  const newLimit = new Decimal(140);
  await asyncClientCall(client, "setJobChargeLimit", { ...params(ua), limit: decimalToMoney(newLimit) });

  await reloadEntity(em, ua);
  expectDecimalEqual(ua.jobChargeLimit, newLimit);
  expect(ua.blockedInCluster).toBe(UserStatus.UNBLOCKED);

});

it("unblocks user if limit > used is positive and state is normal", async () => {
  const limit = new Decimal(100);
  ua.jobChargeLimit = limit;
  ua.usedJobCharge = limit.plus(20);
  ua.blockedInCluster = UserStatus.BLOCKED;
  await em.flush();

  expect(ua.state).toEqual(UserStateInAccount.NORMAL);

  const charge = new Decimal(-20.4);

  await addJobCharge(ua, charge, server.ext, server.logger);

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expectDecimalEqual(ua.usedJobCharge, new Decimal(99.6));
  expect(ua.blockedInCluster).toBe(UserStatus.UNBLOCKED);
  expect(ua.state).toBe(UserStateInAccount.NORMAL);
});

it("still block user if limit > used is positive and state is BLOCKED_BY_ADMIN", async () => {
  const limit = new Decimal(100);
  ua.jobChargeLimit = limit;
  ua.usedJobCharge = limit.plus(20);
  ua.blockedInCluster = UserStatus.BLOCKED;
  ua.state = UserStateInAccount.BLOCKED_BY_ADMIN;
  await em.flush();

  const charge = new Decimal(-20.4);

  await addJobCharge(ua, charge, server.ext, server.logger);

  expectDecimalEqual(ua.jobChargeLimit, limit);
  expectDecimalEqual(ua.usedJobCharge, new Decimal(99.6));
  expect(ua.blockedInCluster).toBe(UserStatus.BLOCKED);
  expect(ua.state).toBe(UserStateInAccount.BLOCKED_BY_ADMIN);
});


it("does nothing if no limit", async () => { const charge = new Decimal(120.4);
  await addJobCharge(ua, charge, server.ext, server.logger);

  expect(ua.jobChargeLimit).toBeUndefined();
  expect(ua.usedJobCharge).toBeUndefined();
  expect(ua.blockedInCluster).toBe(UserStatus.UNBLOCKED);
});

// it("correctly handles multiple concurrent request", async () => {

//   const aa = data.uaAA;
//   const bb = data.uaBB;
//   const ab = data.uaAB;

//   aa.jobChargeLimit = new Decimal(10);
//   aa.usedJobCharge = new Decimal(2);
//   bb.jobChargeLimit = new Decimal(12);
//   bb.usedJobCharge = new Decimal(0);

//   await server.ext.orm.em.flush();

//   const deltas = [
//     { ...params(aa), charge: decimalToMoney(new Decimal(10))  },
//     { ...params(aa), charge: decimalToMoney(new Decimal(12))  },
//     { ...params(bb), charge: decimalToMoney(new Decimal(-12))  },
//     { ...params(aa), charge: decimalToMoney(new Decimal(-6))  },
//     { ...params(bb), charge: decimalToMoney(new Decimal(14))  },
//     { ...params(ab), charge: decimalToMoney(new Decimal(14))  },
//   ] as AddJobChargeRequest[];

//   await Promise.all(deltas.map((x) => asyncClientCall(client, "addJobCharge", x)));

//   await reloadEntities([aa, bb, ab]);

//   expectDecimalEqual(aa.usedJobCharge, new Decimal(18));
//   expect(aa.status).toBe(UserStatus.BLOCKED);

//   expectDecimalEqual(bb.usedJobCharge, new Decimal(2));
//   expect(bb.status).toBe(UserStatus.UNBLOCKED);

//   expect(ab.usedJobCharge).toBeUndefined();
//   expect(ab.status).toBe(UserStatus.UNBLOCKED);

// });
