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

      const jobs = testDataClone.filter((x) =>
        x.cluster === clusterId &&
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


  });

});
