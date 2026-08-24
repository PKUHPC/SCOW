import { Status } from "@grpc/grpc-js/build/src/constants";
import { ListAllJobsRequest_TimeType } from "@scow/protos/build/portal/job";
import { listAllJobsRequestToSchedulerFilter } from "src/services/job";

const startTime = "2026-07-13T00:00:00.000Z";
const endTime = "2026-07-20T00:00:00.000Z";

it("maps all listAllJobs filters and uses submit time", () => {
  expect(
    listAllJobsRequestToSchedulerFilter({
      userId: "user1",
      cluster: "hpc01",
      startTime,
      endTime,
      account: "account1",
      states: ["PENDING", "RUNNING"],
      jobId: 42,
      jobName: "job-name",
      timeType: ListAllJobsRequest_TimeType.SUBMIT_TIME,
    }),
  ).toEqual({
    users: ["user1"],
    accounts: ["account1"],
    states: ["PENDING", "RUNNING"],
    jobId: 42,
    jobName: "job-name",
    submitTime: { startTime, endTime },
  });
});

it("keeps empty filters and uses end time exclusively", () => {
  expect(
    listAllJobsRequestToSchedulerFilter({
      userId: "user1",
      cluster: "hpc01",
      startTime,
      endTime,
      states: [],
      timeType: ListAllJobsRequest_TimeType.END_TIME,
    }),
  ).toEqual({
    users: ["user1"],
    accounts: [],
    states: [],
    jobId: undefined,
    jobName: undefined,
    endTime: { startTime, endTime },
  });
});

it("rejects invalid job states", () => {
  let thrownError: unknown;
  try {
    listAllJobsRequestToSchedulerFilter({
      userId: "user1",
      cluster: "hpc01",
      startTime,
      endTime,
      states: ["UNKNOWN"],
      timeType: ListAllJobsRequest_TimeType.SUBMIT_TIME,
    });
  } catch (error) {
    thrownError = error;
  }

  expect(thrownError).toMatchObject({ code: Status.INVALID_ARGUMENT, details: "Invalid job states: UNKNOWN" });
});
