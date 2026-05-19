import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { ChannelCredentials } from "@grpc/grpc-js";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal, moneyToNumber, numberToMoney } from "@scow/lib-decimal";
import { dayjsToDateMessage } from "@scow/lib-server/build/date";
import { JobFilter, JobServiceClient } from "@scow/protos/build/server/job";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { createServer } from "src/app";
import { JobInfo } from "src/entities/JobInfo";
import { JobPriceChange } from "src/entities/JobPriceChange";
import { UserAccount } from "src/entities/UserAccount";
import { range } from "src/utils/array";
import { reloadEntities } from "src/utils/orm";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";

dayjs.extend(utc);

let server: Server;
let em: SqlEntityManager;
let data: InitialData;

beforeEach(async () => {
  server = await createServer();

  em = server.ext.orm.em.fork();

  data = await insertInitialData(em);

  await server.start();
});

afterEach(async () => {
  await dropDatabase(server.ext.orm);
  await server.close();
});

const mockOriginalJobData = (ua: UserAccount, tenantPrice: Decimal, accountPrice: Decimal, submitTime?: Date) =>
  new JobInfo(
    {
      cluster: "pkuhpc",
      ...{
        events: [],
        pods: [],
        uniqueJobName: "",
        jobId: 5119061,
        account: ua.account.getProperty("accountName"),
        user: ua.user.getProperty("userId"),
        partition: "C032M0128G",
        nodeList: "a5u15n01",
        name: "CoW",
        state: "COMPLETED",
        workingDirectory: "",
        submitTime: submitTime ? submitTime.toISOString() : "2020-04-23T22:23:00.000Z",
        startTime: submitTime ? submitTime.toISOString() : "2020-04-23T22:25:12.000Z",
        endTime: "2020-04-23T23:18:02.000Z",
        gpusAlloc: 0,
        cpusReq: 32,
        memReqMb: 124000,
        nodesReq: 1,
        cpusAlloc: 32,
        memAllocMb: 124000,
        nodesAlloc: 1,
        timeLimitMinutes: 7200,
        elapsedSeconds: 3170,
        timeWait: submitTime ? 0 : 132,
        qos: "normal",
        recordTime: new Date("2020-04-23T23:49:50.000Z"),
        gpusReq: 0,
      },
    },
    data.tenant.name,
    {
      tenant: { billingItemId: "", price: tenantPrice },
      account: { billingItemId: "", price: accountPrice },
    },
  );

function createClient() {
  return new JobServiceClient(server.serverAddress, ChannelCredentials.createInsecure());
}

it("changes job prices", async () => {
  // insert jobs
  const jobs = [
    mockOriginalJobData(data.uaAB, new Decimal(1), new Decimal(2)),
    mockOriginalJobData(data.uaBB, new Decimal(2), new Decimal(4)),
    mockOriginalJobData(data.uaAA, new Decimal(4), new Decimal(8)),
  ];

  data.accountA.balance = new Decimal(100);

  await em.persistAndFlush(jobs);

  const prevTenantBalance = data.tenant.balance;
  const prevABalance = data.accountA.balance;
  const prevBBalance = data.accountB.balance;

  // change the prices job 1,2 to 1.6

  const client = createClient();

  await asyncClientCall(client, "changeJobPrice", {
    filter: { tenantName: data.tenant.name, userId: data.userB.userId, clusters: [], biJobIndexs: [], jobIds: [] },
    ipAddress: "",
    operatorId: "123",
    reason: "test",
    accountPrice: numberToMoney(1.6),
    tenantPrice: numberToMoney(1.7),
  });

  // check prices

  const jobInfo = [0, 1].map((x) => ({
    biJobIndex: jobs[x].biJobIndex,
    accountPrice: jobs[x].accountPrice.toFixed(4),
    tenantPrice: jobs[x].tenantPrice.toFixed(4),
  }));

  await reloadEntities(em, jobs);

  expect(jobs.map((x) => x.tenantPrice.toNumber())).toStrictEqual([1.7, 1.7, 4]);
  expect(jobs.map((x) => x.accountPrice.toNumber())).toStrictEqual([1.6, 1.6, 8]);

  const records = await em.find(JobPriceChange, {});

  expect(records).toHaveLength(1);
  const record = records[0];
  expect(record.jobs).toIncludeSameMembers(jobInfo);
  expect(record.newAccountPrice?.toNumber()).toBe(1.6);
  expect(record.newTenantPrice?.toNumber()).toBe(1.7);

  await reloadEntities(em, [data.tenant, data.accountA, data.accountB]);

  // check balances
  expect(data.tenant.balance.toNumber()).toBe(prevTenantBalance.minus(0.4).toNumber()); // 1-1.7+2-1.7
  expect(data.accountA.balance.toNumber()).toBe(prevABalance.plus(2 - 1.6).toNumber());
  expect(data.accountB.balance.toNumber()).toBe(prevBBalance.plus(4 - 1.6).toNumber());
});

it("returns 50 jobs if pageSize is undefined or 0", async () => {
  const em = server.ext.orm.em.fork();

  await em.persistAndFlush(range(1, 60).map((_) => mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10))));

  const test = async (pageSize?: number) => {
    const client = createClient();

    const reply = await asyncClientCall(client, "getJobs", {
      filter: { tenantName: data.tenant.name, clusters: [], biJobIndexs: [], jobIds: [] },
      page: 1,
      pageSize,
    });

    expect(reply.jobs).toHaveLength(50);
    expect(moneyToNumber(reply.totalAccountPrice!)).toBe(590);
    expect(moneyToNumber(reply.totalTenantPrice!)).toBe(1180);
  };

  await Promise.all([test(0), test()]);
});

it("returns jobs starting from start_bi_job_index", async () => {
  const em = server.ext.orm.em.fork();

  await em.persistAndFlush(range(1, 20).map((_) => mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10))));

  await em.persistAndFlush(range(20, 40).map((_) => mockOriginalJobData(data.uaBB, new Decimal(20), new Decimal(10))));

  await em.persistAndFlush(range(40, 60).map((_) => mockOriginalJobData(data.uaAB, new Decimal(20), new Decimal(10))));

  const client = createClient();

  const reply = await asyncClientCall(client, "getJobs", {
    page: 1,
    pageSize: 100,
    filter: {
      clusters: [],
      biJobIndexs: [],
      jobIds: [],
      tenantName: data.tenant.name,
      startBiJobIndex: 10,
    },
  });

  expect(reply.jobs).toSatisfyAll((x: JobInfo) => x.biJobIndex >= 10);
  expect(reply.jobs).toHaveLength(50);
});

it("returns 0 job if Account not exist or is not in scope of permissions", async () => {
  const em = server.ext.orm.em.fork();

  await em.persistAndFlush(range(1, 20).map((_) => mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10))));

  const test = async (filter: JobFilter) => {
    const client = createClient();
    const reply = await asyncClientCall(client, "getJobs", {
      filter,
      page: 1,
      pageSize: 10,
    });
    expect(reply.jobs).toHaveLength(0);
  };

  await Promise.all([
    // 当用户id与账号无关时，查不到数据
    test({ tenantName: "default2", clusters: [], biJobIndexs: [], jobIds: [] }),
    // 当用户id与账号无关时，查不到数据
    test({ tenantName: data.tenant.name, userId: "a", accountName: "hpcb", clusters: [], biJobIndexs: [], jobIds: [] }),
  ]);
});

it("get Top Submit Job Users correctly", async () => {
  const em = server.ext.orm.em.fork();

  const today = dayjs();

  const userAJobs = range(0, 20).map((_) =>
    mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10), today.toDate()),
  );
  const userBJobs = range(0, 30).map((_) =>
    mockOriginalJobData(data.uaBB, new Decimal(20), new Decimal(10), today.toDate()),
  );
  const userCJobs = range(0, 40).map((_) =>
    mockOriginalJobData(data.uaCC, new Decimal(20), new Decimal(10), today.toDate()),
  );
  await em.persistAndFlush([...userAJobs, ...userBJobs, ...userCJobs]);

  const client = createClient();
  const reply = await asyncClientCall(client, "getTopSubmitJobUsers", {
    startTime: today.startOf("day").toISOString(),
    endTime: today.endOf("day").toISOString(),
  });

  expect(reply.results).toMatchObject([
    { userId: data.userC.userId, count: 40 },
    { userId: data.userB.userId, count: 30 },
    { userId: data.userA.userId, count: 20 },
  ]);
});

it("get new job count correctly in UTC+8 timezone", async () => {
  const today = dayjs();

  const yesterday = today.clone().subtract(1, "day");

  const twoDaysBefore = today.clone().subtract(2, "day");

  const threeDaysBofre = today.clone().subtract(3, "day");

  const todayJobs = range(0, 20).map((_) =>
    mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10), today.toDate()),
  );
  const yesterdayJobs = range(0, 30).map((_) =>
    mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10), yesterday.toDate()),
  );
  const twoDaysBeforeJobs = range(0, 15).map((_) =>
    mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10), twoDaysBefore.toDate()),
  );
  const threeDaysBeforeJobs = range(0, 1).map((_) =>
    mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10), threeDaysBofre.toDate()),
  );
  await em.persistAndFlush([...todayJobs, ...yesterdayJobs, ...twoDaysBeforeJobs, ...threeDaysBeforeJobs]);

  const client = createClient();
  const reply = await asyncClientCall(client, "getNewJobCount", {
    startTime: today.clone().subtract(3, "day").startOf("day").toISOString(),
    endTime: today.endOf("day").toISOString(),
    timeZone: "Asia/Shanghai",
  });

  const todayInUtcPlus8 = today.utcOffset(8);
  const yesterdayInUtcPlus8 = yesterday.utcOffset(8);
  const twoDaysBeforeInUtcPlus8 = twoDaysBefore.utcOffset(8);
  const threeDaysBeforeInUtcPlus8 = threeDaysBofre.utcOffset(8);

  expect(reply.results).toMatchObject([
    {
      date: dayjsToDateMessage(todayInUtcPlus8),
      count: 20,
    },
    {
      date: dayjsToDateMessage(yesterdayInUtcPlus8),
      count: 30,
    },
    {
      date: dayjsToDateMessage(twoDaysBeforeInUtcPlus8),
      count: 15,
    },
    {
      date: dayjsToDateMessage(threeDaysBeforeInUtcPlus8),
      count: 1,
    },
  ]);
});

it("get Users With Most Job Submissions correctly", async () => {
  const em = server.ext.orm.em.fork();

  const today = dayjs();

  const userAJobs = range(0, 20).map((_) =>
    mockOriginalJobData(data.uaAA, new Decimal(20), new Decimal(10), today.toDate()),
  );
  const userBJobs = range(0, 30).map((_) =>
    mockOriginalJobData(data.uaBB, new Decimal(20), new Decimal(10), today.toDate()),
  );
  const userCJobs = range(0, 40).map((_) =>
    mockOriginalJobData(data.uaCC, new Decimal(20), new Decimal(10), today.toDate()),
  );
  await em.persistAndFlush([...userAJobs, ...userBJobs, ...userCJobs]);

  const client = createClient();
  const reply = await asyncClientCall(client, "getUsersWithMostJobSubmissions", {
    startTime: today.startOf("day").toISOString(),
    endTime: today.endOf("day").toISOString(),
  });

  expect(reply.results).toMatchObject([
    { userName: data.userC.name, userId: data.userC.userId, count: 40 },
    { userName: data.userB.name, userId: data.userB.userId, count: 30 },
    { userName: data.userA.name, userId: data.userA.userId, count: 20 },
  ]);
});
