import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { JobField, JobServiceClient } from "@scow/protos/build/server/job";
import { getClientFn } from "src/api";
import { libGetMisHistoryJobSubmitTimes, libGetMisJobsWithFields } from "src/misCommon/job";
import { Logger } from "ts-log";

jest.mock("@ddadaal/tsgrpc-client", () => ({ asyncClientCall: jest.fn() }));
jest.mock("src/api", () => ({ getClientFn: jest.fn() }));

const mockedAsyncClientCall = jest.mocked(asyncClientCall);
const mockedGetClientFn = jest.mocked(getClientFn);
const mockedLogger = { trace: jest.fn(), info: jest.fn() };
const logger = mockedLogger as unknown as Logger;
const jobClient = { type: "job" };
const userClient = { type: "user" };

beforeEach(() => {
  jest.resetAllMocks();
  mockedGetClientFn.mockReturnValue(((ctor: unknown) =>
    ctor === JobServiceClient ? jobClient : userClient) as ReturnType<typeof getClientFn>);
});

it("verifies the user before querying scoped job fields", async () => {
  const calls: string[] = [];
  mockedAsyncClientCall.mockImplementation(async (client: any, method: any, request: any) => {
    calls.push(method);
    if (client === userClient) return { tenantName: "tenant-a" } as never;

    expect(request).toMatchObject({
      jobFilter: {
        tenantName: "tenant-a",
        clusters: ["cluster-a"],
        userId: "user-a",
        jobIds: [101],
      },
      resultFields: [JobField.JOB_FIELD_ID_JOB, JobField.JOB_FIELD_TIME_SUBMIT],
      pageSize: 10000,
    });
    return { jobs: [{ idJob: 101, timeSubmit: "2026-01-02T03:04:05.000Z" }] } as never;
  });

  const result = await libGetMisHistoryJobSubmitTimes(
    logger,
    { cluster: "cluster-a", userId: "user-a", jobIds: [101] },
    "mis-server:5000",
    "token",
  );

  expect(calls).toEqual(["getUserInfo", "getJobsWithFields"]);
  expect(result.get(101)).toBe("2026-01-02T03:04:05.000Z");
});

it("does not query jobs when user verification fails", async () => {
  mockedAsyncClientCall.mockRejectedValueOnce(new Error("user not found"));

  await expect(
    libGetMisHistoryJobSubmitTimes(
      logger,
      { cluster: "cluster-a", userId: "missing", jobIds: [101] },
      "mis-server:5000",
    ),
  ).rejects.toThrow("user not found");

  expect(mockedAsyncClientCall).toHaveBeenCalledTimes(1);
  expect(mockedAsyncClientCall.mock.calls[0][1]).toBe("getUserInfo");
});

it("returns early for an empty job id list", async () => {
  const result = await libGetMisHistoryJobSubmitTimes(
    logger,
    { cluster: "cluster-a", userId: "user-a", jobIds: [] },
    "mis-server:5000",
  );

  expect(result.size).toBe(0);
  expect(mockedGetClientFn).not.toHaveBeenCalled();
  expect(mockedAsyncClientCall).not.toHaveBeenCalled();
});

it("splits large requests and merges available submit times", async () => {
  const jobIds = Array.from({ length: 10001 }, (_, index) => index + 1);
  mockedAsyncClientCall.mockImplementation(async (client: any, method: any, request: any) => {
    if (client === userClient) return { tenantName: "tenant-a" } as never;
    const requestedIds = request.jobFilter.jobIds as number[];
    return {
      jobs:
        requestedIds[0] === 1
          ? [{ idJob: 1, timeSubmit: "first" }, { idJob: 2 }]
          : [
              { idJob: 10001, timeSubmit: "last" },
              { idJob: 1, timeSubmit: "updated" },
            ],
    } as never;
  });

  const result = await libGetMisHistoryJobSubmitTimes(
    logger,
    { cluster: "cluster-a", userId: "user-a", jobIds },
    "mis-server:5000",
  );

  const jobRequests = mockedAsyncClientCall.mock.calls.filter(([, method]) => String(method) === "getJobsWithFields");
  expect(jobRequests).toHaveLength(2);
  expect((jobRequests[0][2] as any).jobFilter.jobIds).toHaveLength(10000);
  expect((jobRequests[1][2] as any).jobFilter.jobIds).toEqual([10001]);
  expect([...result.entries()]).toEqual([
    [1, "updated"],
    [10001, "last"],
  ]);
});

it("uses a custom page size until the server omits the next cursor", async () => {
  mockedAsyncClientCall.mockImplementation(async (_client: any, _method: any, request: any) => {
    if (request.afterBiJobIndex === undefined) {
      return { jobs: [{ biJobIndex: 1 }], nextBiJobIndex: 1 } as never;
    }
    if (request.afterBiJobIndex === 1) {
      return { jobs: [{ biJobIndex: 2 }], nextBiJobIndex: 2 } as never;
    }
    return { jobs: [{ biJobIndex: 3 }] } as never;
  });

  const jobs = await libGetMisJobsWithFields(jobClient as unknown as JobServiceClient, {
    jobFilter: { tenantName: "tenant-a" },
    resultFields: [JobField.JOB_FIELD_BI_JOB_INDEX],
    pageSize: 1,
    logger,
  });

  expect(jobs.map((job) => job.biJobIndex)).toEqual([1, 2, 3]);
  expect(mockedAsyncClientCall.mock.calls.map(([, , request]: any[]) => request.afterBiJobIndex)).toEqual([
    undefined,
    1,
    2,
  ]);
});

it("uses the common default page size when pageSize is omitted", async () => {
  mockedAsyncClientCall
    .mockResolvedValueOnce({ jobs: [{ biJobIndex: 1 }], nextBiJobIndex: 1 } as never)
    .mockResolvedValueOnce({ jobs: [{ biJobIndex: 2 }] } as never);

  const jobs = await libGetMisJobsWithFields(jobClient as unknown as JobServiceClient, {
    jobFilter: { tenantName: "tenant-a" },
    resultFields: [JobField.JOB_FIELD_BI_JOB_INDEX],
  });

  expect(jobs.map((job) => job.biJobIndex)).toEqual([1, 2]);
  expect(mockedAsyncClientCall.mock.calls).toSatisfyAll(([, , request]: any[]) => {
    return request.pageSize === 5000;
  });
});

it("splits known job IDs by the default page size", async () => {
  const jobIds = Array.from({ length: 5001 }, (_, index) => index + 1);
  mockedAsyncClientCall.mockResolvedValue({ jobs: [] } as never);

  await libGetMisJobsWithFields(jobClient as unknown as JobServiceClient, {
    jobFilter: { tenantName: "tenant-a", jobIds },
    resultFields: [JobField.JOB_FIELD_ID_JOB],
  });

  expect(mockedAsyncClientCall).toHaveBeenCalledTimes(2);
  expect((mockedAsyncClientCall.mock.calls[0][2] as any).jobFilter.jobIds).toHaveLength(5000);
  expect((mockedAsyncClientCall.mock.calls[1][2] as any).jobFilter.jobIds).toEqual([5001]);
});

it("rejects a non-increasing cursor to prevent an infinite loop", async () => {
  mockedAsyncClientCall
    .mockResolvedValueOnce({ jobs: [{ biJobIndex: 1 }], nextBiJobIndex: 1 } as never)
    .mockResolvedValueOnce({ jobs: [{ biJobIndex: 1 }], nextBiJobIndex: 1 } as never);

  await expect(
    libGetMisJobsWithFields(jobClient as unknown as JobServiceClient, {
      jobFilter: { tenantName: "tenant-a" },
      resultFields: [JobField.JOB_FIELD_BI_JOB_INDEX],
    }),
  ).rejects.toMatchObject({
    code: status.INTERNAL,
    details: "getJobsWithFields returned a non-increasing next_bi_job_index",
  });
});

it.each([0, -1, 1.5, 0x1_0000_0000])("rejects invalid pageSize %s", async (pageSize) => {
  await expect(
    libGetMisJobsWithFields(jobClient as unknown as JobServiceClient, {
      jobFilter: { tenantName: "tenant-a" },
      resultFields: [JobField.JOB_FIELD_ID_JOB],
      pageSize,
    }),
  ).rejects.toMatchObject({
    code: status.INVALID_ARGUMENT,
    details: "pageSize must be an integer between 1 and 4294967295",
  });
  expect(mockedAsyncClientCall).not.toHaveBeenCalled();
});
