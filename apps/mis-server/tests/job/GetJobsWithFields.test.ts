import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Server } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal } from "@scow/lib-decimal";
import { JobField, JobServiceClient } from "@scow/protos/build/server/job";
import { createServer } from "src/app";
import { JobInfo } from "src/entities/JobInfo";
import { UserAccount } from "src/entities/UserAccount";
import * as jobUtils from "src/utils/job";
import { InitialData, insertInitialData } from "tests/data/data";
import { dropDatabase } from "tests/data/helpers";
import { createTestClient } from "tests/utils";

let server: Server | undefined;
let em: SqlEntityManager;
let data: InitialData;
let clients: JobServiceClient[];

beforeEach(async () => {
  server = undefined;
  clients = [];
  server = await createServer();
  em = server.ext.orm.em.fork();
  data = await insertInitialData(em);
  await server.start();
});

afterEach(async () => {
  jest.restoreAllMocks();
  clients.forEach((client) => client.close());

  if (!server) return;
  const currentServer = server;
  server = undefined;
  try {
    await dropDatabase(currentServer.ext.orm);
  } finally {
    await currentServer.close();
  }
});

function createClient() {
  if (!server) throw new Error("Test server is not initialized");
  const client = createTestClient(server.serverAddress, JobServiceClient);
  clients.push(client);
  return client;
}

function createJob(ua: UserAccount, jobId: number, cluster = "cluster-a") {
  return new JobInfo(
    {
      events: [],
      pods: [],
      uniqueJobName: "",
      cluster,
      jobId,
      account: ua.account.getProperty("accountName"),
      user: ua.user.getProperty("userId"),
      partition: "compute",
      nodeList: "node01",
      name: `job-${jobId}`,
      state: "COMPLETED",
      workingDirectory: "",
      submitTime: "2026-01-02T03:04:05.000Z",
      startTime: "2026-01-02T03:05:05.000Z",
      endTime: "2026-01-02T03:06:05.000Z",
      gpusAlloc: 0,
      cpusReq: 1,
      memReqMb: 1024,
      nodesReq: 1,
      cpusAlloc: 1,
      memAllocMb: 1024,
      nodesAlloc: 1,
      timeLimitMinutes: 60,
      elapsedSeconds: 60,
      qos: "normal",
      gpusReq: 0,
    },
    ua.account.getProperty("tenant").getProperty("name"),
    {
      tenant: { billingItemId: "", price: new Decimal(1) },
      account: { billingItemId: "", price: new Decimal(2) },
    },
    60,
  );
}

const filter = (tenantName = data.tenant.name) => ({
  tenantName,
  clusters: [] as string[],
  jobIds: [] as number[],
  biJobIndexs: [] as number[],
});

it("returns the requested job id and submit time", async () => {
  const job = createJob(data.uaAA, 101);
  await em.persistAndFlush(job);

  const reply = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: { ...filter(), jobIds: [101], clusters: ["cluster-a"] },
    resultFields: [JobField.JOB_FIELD_ID_JOB, JobField.JOB_FIELD_TIME_SUBMIT],
  });

  expect(reply.jobs).toHaveLength(1);
  expect(reply.jobs[0].idJob).toBe(101);
  expect(reply.jobs[0].timeSubmit).toBe("2026-01-02T03:04:05.000Z");
});

it("uses cluster scope to distinguish repeated scheduler job ids", async () => {
  await em.persistAndFlush([createJob(data.uaAA, 101, "cluster-a"), createJob(data.uaAA, 101, "cluster-b")]);

  const reply = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: { ...filter(), jobIds: [101], clusters: ["cluster-b"] },
    resultFields: [JobField.JOB_FIELD_ID_JOB, JobField.JOB_FIELD_CLUSTER],
  });

  expect(reply.jobs).toHaveLength(1);
  expect(reply.jobs[0]).toMatchObject({ idJob: 101, cluster: "cluster-b" });
});

it("returns stable pages ordered by biJobIndex", async () => {
  await em.persistAndFlush([createJob(data.uaAA, 103), createJob(data.uaAA, 101), createJob(data.uaAA, 102)]);

  const firstPage = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: filter(),
    resultFields: [JobField.JOB_FIELD_BI_JOB_INDEX],
    pageSize: 2,
  });
  expect(firstPage.nextBiJobIndex).toBe(firstPage.jobs[1].biJobIndex);

  const secondPage = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: filter(),
    resultFields: [JobField.JOB_FIELD_BI_JOB_INDEX],
    afterBiJobIndex: firstPage.nextBiJobIndex,
    pageSize: 2,
  });

  const indexes = [...firstPage.jobs, ...secondPage.jobs].map((job) => job.biJobIndex);
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  expect(new Set(indexes).size).toBe(3);
  expect(secondPage.nextBiJobIndex).toBeUndefined();
});

it("returns all matching jobs in one page when pageSize covers the result", async () => {
  await em.persistAndFlush(Array.from({ length: 51 }, (_, index) => createJob(data.uaAA, index + 1)));

  const reply = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: filter(),
    resultFields: [JobField.JOB_FIELD_ID_JOB],
    pageSize: 51,
  });

  expect(reply.jobs).toHaveLength(51);
  expect(reply.nextBiJobIndex).toBeUndefined();
});

it("uses the default page size when pageSize is omitted", async () => {
  await em.persistAndFlush(Array.from({ length: 5001 }, (_, index) => createJob(data.uaAA, index + 1)));

  const reply = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: filter(),
    resultFields: [JobField.JOB_FIELD_ID_JOB],
  });

  expect(reply.jobs).toHaveLength(5000);
  expect(reply.nextBiJobIndex).toBeDefined();
});

it("reuses account, user name, owner name, and bi-job-index filters", async () => {
  const matchingJob = createJob(data.uaAA, 101);
  await em.persistAndFlush([matchingJob, createJob(data.uaBB, 102)]);

  const reply = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: {
      ...filter(),
      accountName: data.accountA.accountName,
      userIdOrName: "AName",
      ownerIdOrName: "AName",
      biJobIndexs: [matchingJob.biJobIndex],
    },
    resultFields: [JobField.JOB_FIELD_ID_JOB],
  });

  expect(reply.jobs.map((job) => job.idJob)).toEqual([101]);
});

it.each([
  { resultFields: [] as JobField[], pageSize: 1 },
  { resultFields: [JobField.JOB_FIELD_UNSPECIFIED], pageSize: 1 },
  { resultFields: [JobField.JOB_FIELD_ID_JOB, JobField.JOB_FIELD_UNSPECIFIED], pageSize: 1 },
  { resultFields: [999 as JobField], pageSize: 1 },
  { resultFields: [JobField.JOB_FIELD_ID_JOB], pageSize: 0 },
])("rejects invalid projection request %#", async ({ resultFields, pageSize }) => {
  await expect(
    asyncClientCall(createClient(), "getJobsWithFields", {
      jobFilter: filter(),
      resultFields,
      pageSize,
    }),
  ).rejects.toMatchObject({ code: status.INVALID_ARGUMENT });
});

it("loads derived details only when a derived field is requested", async () => {
  const job = createJob(data.uaAA, 101);
  await em.persistAndFlush(job);
  const detailsSpy = jest.spyOn(jobUtils, "getJobUserAndAccountOwnerDetailsMap");

  await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: { ...filter(), jobIds: [101] },
    resultFields: [JobField.JOB_FIELD_ID_JOB],
  });
  expect(detailsSpy).not.toHaveBeenCalled();

  const reply = await asyncClientCall(createClient(), "getJobsWithFields", {
    jobFilter: { ...filter(), jobIds: [101] },
    resultFields: [
      JobField.JOB_FIELD_USER_NAME,
      JobField.JOB_FIELD_ACCOUNT_OWNER_ID,
      JobField.JOB_FIELD_ACCOUNT_OWNER_NAME,
    ],
  });

  expect(detailsSpy).toHaveBeenCalledTimes(1);
  expect(reply.jobs[0]).toMatchObject({ userName: "AName", accountOwnerId: "a", accountOwnerName: "AName" });
});
