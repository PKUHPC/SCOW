import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { plugin } from "@ddadaal/tsgrpc-server";
import { numberToMoney } from "@scow/lib-decimal";
import { jobInfoToPortalJobInfo, jobInfoToRunningjob } from "@scow/lib-scheduler-adapter";
import { getClusterAssignedAccounts } from "@scow/lib-scow-resource";
import { libGetAccounts, libGetUserInfo } from "@scow/lib-server";
import { libCalculateJobPrice } from "@scow/lib-server/build/misCommon/calculatePrice";
import { JobServiceServer, JobServiceService } from "@scow/protos/build/portal/job";
import { getClusterOps } from "src/clusterops";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
import { callOnOne, checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { convertMaxTimeToMinutes, validateMaxRunningTimeMinutes, HPCJobLabelType } from "src/utils/maxRunningTime";
import { getClusterLoginNode } from "src/utils/clusterNodes";
import { validateSubmitJobInfoUnderMis } from "src/utils/validation";

export const jobServiceServer = plugin((server) => {
  server.addService<JobServiceServer>(JobServiceService, {
    cancelJob: async ({ request, logger }) => {
      const { cluster, jobId, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      await callOnOne(
        cluster,
        logger,
        async (client) =>
          await asyncClientCall(client.job, "cancelJob", {
            userId,
            jobId,
          }),
      );

      return [{}];
    },

    listAccounts: async ({ request, logger }) => {
      const { cluster, userId, statusFilter } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const userInfo = await libGetUserInfo(logger, userId, config.MIS_SERVER_URL, commonConfig.scowApi.auth.token);
      const tenantName = userInfo.tenantName;
      // 获取资源管理中的这个集群和租户下授权的账户名信息
      const clusterAssignedAccountNames = await getClusterAssignedAccounts(
        commonConfig.scowResource,
        cluster,
        tenantName,
      );
      // 获取scow数据库中账户数据
      const misAccounts = await libGetAccounts(
        logger,
        userId,
        statusFilter,
        config.MIS_SERVER_URL,
        commonConfig.scowApi.auth.token,
      );

      const filteredAccounts = misAccounts.accounts.filter((account) =>
        clusterAssignedAccountNames.includes(account),
      );

      return [{ accounts: filteredAccounts }];
    },

    listRunningJobs: async ({ request, logger }) => {
      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) =>
          await asyncClientCall(client.job, "getJobs", {
            fields: [
              "job_id",
              "partition",
              "name",
              "user",
              "state",
              "elapsed_seconds",
              "nodes_req",
              "nodes_alloc",
              "node_list",
              "reason",
              "account",
              "cpus_req",
              "cpus_alloc",
              "gpus_req",
              "gpus_alloc",
              "qos",
              "submit_time",
              "time_limit_minutes",
              "working_directory",
              "mem_req_mb",
              "mem_alloc_mb",
              "start_time",
              "end_time",
            ],
            jobTypes: [],
            filter: { users: [userId], accounts: [], states: ["PENDING", "RUNNING"] },
          }),
      );

      return [{ results: reply.jobs.map(jobInfoToRunningjob) }];
    },

    listAllJobs: async ({ request, logger }) => {
      const { cluster, userId, endTime, startTime } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) =>
          await asyncClientCall(client.job, "getJobs", {
            fields: [
              "job_id",
              "name",
              "account",
              "partition",
              "qos",
              "state",
              "working_directory",
              "nodes_req",
              "nodes_alloc",
              "node_list",
              "reason",
              "elapsed_seconds",
              "time_limit_minutes",
              "submit_time",
              "start_time",
              "end_time",
              "cpus_req",
              "cpus_alloc",
              "gpus_req",
              "gpus_alloc",
              "mem_req_mb",
              "mem_alloc_mb",
            ],
            jobTypes: [],
            filter: {
              users: [userId],
              accounts: [],
              states: [],
              submitTime: { startTime, endTime },
            },
          }),
      );

      return [{ results: reply.jobs.map(jobInfoToPortalJobInfo) }];
    },

    submitJob: async ({ request, logger }) => {
      const { cluster, userId, account, partition, maxTime, maxTimeUnit } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      await validateSubmitJobInfoUnderMis({
        userId,
        accountName: account,
        clusterId: cluster,
        logger,
        partitionName: partition,
        checkAccountApp: false,
      });

      validateMaxRunningTimeMinutes(
        convertMaxTimeToMinutes(maxTime, maxTimeUnit),
        configClusters[cluster]?.hpc.job?.maxRunningTimeHours,
        HPCJobLabelType.job,
      );

      const clusterOps = getClusterOps(cluster);
      if (!clusterOps) {
        throw clusterNotFound(cluster);
      }

      const { jobId } = await clusterOps.job.submitJob({ ...request }, logger);

      return [{ jobId }];
    },

    submitFileAsJob: async ({ request, logger }) => {
      const { cluster } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);
      if (!host) {
        throw clusterNotFound(cluster);
      }

      const clusterOps = getClusterOps(cluster);
      if (!clusterOps) {
        throw clusterNotFound(cluster);
      }

      const { jobId } = await clusterOps.job.submitFileAsJob({ ...request }, logger);

      return [{ jobId }];
    },

    calculateJobPrice: async ({ request, logger }) => {
      try {
        const { accountName, ...restRequest } = request;
        const price = await libCalculateJobPrice(
          logger,
          {
            ...restRequest,
            account: accountName,
          },
          config.MIS_SERVER_URL,
          commonConfig.scowApi.auth.token,
        );

        return [{ accountPrice: price.accountPrice ?? numberToMoney(0) }];
      } catch (error) {
        logger.error("calculate job price failed : %o", error);
        return [{ accountPrice: numberToMoney(0) }];
      }
    },
  });
});
