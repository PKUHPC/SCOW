import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal, decimalToMoney } from "@scow/lib-decimal";
import { dayjsToDateMessage } from "@scow/lib-server/build/date";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { createServer } from "src/app";
import { Account } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { Tenant } from "src/entities/Tenant";
import { User } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient } from "tests/utils";

dayjs.extend(utc);

let server: Server;
let em: SqlEntityManager;

beforeEach(async () => {
  server = await createServer();

  em = server.ext.orm.em.fork();

  const tenant = new Tenant({ name: "test" });

  const createAccount = (index: number) =>
    new Account({
      accountName: `top${index}`,
      tenant,
      blockedInCluster: false,
      comment: `top${index}`,
    });

  const accounts = Array.from({ length: 10 }, (_, i) => createAccount(i + 1));

  // 创建关联的USER
  const createUser = (index: number) =>
    new User({
      userId: `${index}`,
      name: `top${index}UserName`,
      email: `user${index}@foxmail.com`,
      tenant: tenant,
    });

  // 创建UserAccount并插入数据库
  const users = accounts.map((_, index) => createUser(index + 1));
  const userAccounts = users.map(
    (user, index) =>
      new UserAccount({
        account: accounts[index],
        user: user,
        role: UserRole.OWNER,
        blockedInCluster: UserStatus.UNBLOCKED,
      }),
  );

  const chargeRecords: ChargeRecord[] = [];
  const payRecords: PayRecord[] = [];
  const date = dayjs().startOf("day");

  accounts.forEach((account, index) => {
    const topNumber = +account.accountName.replace("top", "");
    const curDate = date.clone().subtract(topNumber - 1, "day");
    chargeRecords.push(
      new ChargeRecord({
        time: curDate.toDate(),
        target: account,
        type: "test",
        comment: "test",
        amount: new Decimal(100 * (11 - topNumber)),
        userId: `${index + 1}`, // 确保 userId 正确设置
      }),
    );
    payRecords.push(
      new PayRecord({
        time: curDate.toDate(),
        target: account,
        type: "test",
        comment: "test",
        amount: new Decimal(100 * (11 - topNumber)),
        operatorId: "test",
        ipAddress: "127.0.0.1",
      }),
    );
  });

  await em.persistAndFlush([tenant, ...accounts, ...users, ...userAccounts, ...chargeRecords, ...payRecords]);

  await server.start();
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

it("correct get Top 10 Charge Account", async () => {
  const client = createTestClient(server.serverAddress, ChargingServiceClient);

  const today = dayjs().startOf("day");

  const tenDaysAgo = today.clone().subtract(9, "day");

  const reply = await asyncClientCall(client, "getTopChargeAccount", {
    startTime: tenDaysAgo.toISOString(),
    endTime: today.toISOString(),
    topRank: 10,
  });

  const results = Array.from({ length: 10 }, (_, i) => ({
    accountName: `top${i + 1}`,
    userName: `top${i + 1}UserName`,
    chargedAmount: decimalToMoney(new Decimal(100 * (11 - (i + 1)))),
  }));

  expect(reply.results).toMatchObject(results);
});

it("correct get daily Charge Amount in UTC+8 timezone", async () => {
  const client = createTestClient(server.serverAddress, ChargingServiceClient);

  const today = dayjs().startOf("day");

  const tenDaysAgo = today.clone().subtract(9, "day");

  const reply = await asyncClientCall(client, "getDailyCharge", {
    startTime: tenDaysAgo.toISOString(),
    endTime: today.toISOString(),
    timeZone: "Asia/Shanghai",
  });

  const todayInUtcPlus8 = today.utcOffset(8);

  const results = Array.from({ length: 10 }, (_, i) => {
    const curDateInUtcPlus8 = todayInUtcPlus8.subtract(i, "day");
    return {
      date: dayjsToDateMessage(curDateInUtcPlus8),
      amount: decimalToMoney(new Decimal(100 * (11 - (i + 1)))),
    };
  });

  expect(reply.results).toMatchObject(results);
});

it("correct get Top 10 Pay Account", async () => {
  const client = createTestClient(server.serverAddress, ChargingServiceClient);

  const today = dayjs().startOf("day");

  const tenDaysAgo = today.clone().subtract(9, "day");

  const reply = await asyncClientCall(client, "getTopPayAccount", {
    startTime: tenDaysAgo.toISOString(),
    endTime: today.toISOString(),
    topRank: 10,
  });

  const results = Array.from({ length: 10 }, (_, i) => ({
    accountName: `top${i + 1}`,
    userName: `top${i + 1}UserName`,
    payAmount: decimalToMoney(new Decimal(100 * (11 - (i + 1)))),
  }));

  expect(reply.results).toMatchObject(results);
});

it("correct get daily Pay Amount in UTC+8 timezone", async () => {
  const client = createTestClient(server.serverAddress, ChargingServiceClient);

  const today = dayjs().startOf("day");

  const tenDaysAgo = today.clone().subtract(9, "day");

  const reply = await asyncClientCall(client, "getDailyPay", {
    startTime: tenDaysAgo.toISOString(),
    endTime: today.toISOString(),
    timeZone: "Asia/Shanghai",
  });

  const todayInUtcPlus8 = today.utcOffset(8);

  const results = Array.from({ length: 10 }, (_, i) => {
    const curDateInUtcPlus8 = todayInUtcPlus8.subtract(i, "day");
    return {
      date: dayjsToDateMessage(curDateInUtcPlus8),
      amount: decimalToMoney(new Decimal(100 * (11 - (i + 1)))),
    };
  });

  expect(reply.results).toMatchObject(results);
});
