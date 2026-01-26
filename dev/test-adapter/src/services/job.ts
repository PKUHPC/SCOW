import { plugin } from "@ddadaal/tsgrpc-server";
import { JobServiceServer, JobServiceService } from "@scow/scheduler-adapter-protos/build/job";
import { clusterId } from "src/config/cluster";
import testData from "src/testData.json";

export const jobServiceServer = plugin((server) => {
  server.addService<JobServiceServer>(JobServiceService, {
    getJobs: async ({ request }) => {
      const endTimeRange = request.filter?.endTime;
      const accountNames = request.filter?.accounts;
      const users = request.filter?.users;

      // 用于筛选deleteUser以及其他有accounts限制的接口
      let testDataClone = testData.filter((x) => {
        if (accountNames && accountNames.length !== 0) {
          return accountNames.includes(x.account);
        }
        return true;
      });

      testDataClone = testDataClone.filter((x) => {
        if (users && users.length !== 0) {
          return users.includes(x.user);
        }
        return true;
      });

      const jobs = testDataClone.filter((x) => x.cluster === clusterId &&
        (endTimeRange ?
          new Date(x.endTime) >= new Date(endTimeRange.startTime ?? 0) &&
          new Date(x.endTime) <= new Date(endTimeRange.endTime ?? 0)
          : true
        ))
        .map(({ tenant, tenantPrice, accountPrice, cluster, ...rest }) => {
          return {
            ...rest,
            state: "COMPLETED",
            workingDirectory: "",
            pods: [],
            events: [],
            uniqueJobName: `${cluster}-${rest.jobId}`,
          };
        });

      return [{
        jobs,
        totalCount: jobs.length,
      }];
    },

    getJobById: async () => {
      return [{}];
    },

    changeJobTimeLimit: async () => {
      return [{}];
    },

    queryJobTimeLimit: async () => {
      return [{ timeLimitMinutes: 0 }];
    },

    submitJob: async () => {
      return [{ jobId: 1, generatedScript: "" }];
    },

    submitScriptAsJob: async () => {
      return [{ jobId: 1 }];
    },

    cancelJob: async () => {
      return [{}];
    },

    runCommandOnJobNodes: async () => {
      return [{ stdout: "", stderr: "" }];
    },

    getPodLogs: async () => {
    },

    createDevHost: async () => {
      return [{ jobId: 1 }];
    },

    submitInferJob: async () => {
      return [{ jobId: 1 }];
    },

    getPodMonitorInfo: async () => {
      return [{ monitorData: []}];
    },
    streamJobShell: async (call) => {
      call.on("data", () => {
        // no-op for test adapter
      });
      call.on("end", () => {
        call.end();
      });
    },
  });

});
