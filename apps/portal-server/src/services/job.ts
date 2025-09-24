import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { plugin } from "@ddadaal/tsgrpc-server";
import { jobInfoToPortalJobInfo, jobInfoToRunningjob } from "@scow/lib-scheduler-adapter";
import { getClusterAssignedAccounts } from "@scow/lib-scow-resource";
import { libGetAccounts, libGetUserInfo } from "@scow/lib-server";
import { AccountStatusFilter, JobServiceServer, JobServiceService } from "@scow/protos/build/portal/job";
import { getClusterOps } from "src/clusterops";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
import { callOnOne, checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getClusterLoginNode } from "src/utils/ssh";
import { validateSubmitJobInfoUnderMis } from "src/utils/validation";

export const jobServiceServer = plugin((server) => {

  server.addService<JobServiceServer>(JobServiceService, {

    cancelJob: async ({ request, logger }) => {

      const { cluster, jobId, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.job, "cancelJob", {
          userId, jobId,
        }),
      );

      return [{}];

    },

    listAccounts: async ({ request, logger }) => {
      const { cluster, userId, statusFilter } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      // 如果已部署了管理系统和资源管理系统，获取集群下已授权的账户 与管理系统数据的交集
      if (config.MIS_DEPLOYED && commonConfig.scowResource?.enabled) {

        // 获取用户在scow中的信息
        const userInfo = await libGetUserInfo(logger,
          userId,
          config.MIS_SERVER_URL,
          commonConfig.scowApi?.auth?.token,
        );
        const tenantName = userInfo.tenantName;
        // 获取资源管理中的这个集群和租户下授权的账户名信息
        const clusterAssignedAccountNames = await getClusterAssignedAccounts(
          commonConfig.scowResource,
          cluster,
          tenantName,
        );
        // 获取scow数据库中账户数据
        const misAccounts = await libGetAccounts(logger,
          userId,
          statusFilter,
          config.MIS_SERVER_URL,
          commonConfig.scowApi?.auth?.token);

        const filteredAccounts
               = misAccounts.accounts.filter((account) => clusterAssignedAccountNames.includes(account));

        return [{ accounts: filteredAccounts }];
      }

      // 如果已部署了管理系统，从管理系统数据库中获取账户数据
      if (config.MIS_DEPLOYED) {
        const result = await libGetAccounts(logger,
          userId,
          statusFilter,
          config.MIS_SERVER_URL,
          commonConfig.scowApi?.auth?.token);
        return [result];
      }

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.account, "listAccounts", {
          userId,
        }),
      );

      const accounts = reply.accounts;

      if ((statusFilter === undefined) || statusFilter === AccountStatusFilter.ALL) {
        return [{ accounts: accounts }];
      }

      const filteredUnblockedAccounts: string[] = [];
      const filteredBlockedAccounts: string[] = [];
      const filteredUnblockedUserAccounts: string[] = [];
      const filteredBlockedUserAccounts: string[] = [];

      const filterAccountPromise = Promise.allSettled(accounts.map(async (account) => {
        try {
          const resp = await callOnOne(
            cluster,
            logger,
            // 当没有特殊指定时，为查询所有分区下的状态
            async (client) => await asyncClientCall(client.account, "queryAccountBlockStatus", {
              accountName: account,
            }),
          );
          if (resp.blocked) {
            filteredBlockedAccounts.push(account);
          } else {
            filteredUnblockedAccounts.push(account);
          }
        } catch (error) {
          logger.error(`Error occured when query the block status of ${account}.`, error);
        }
      }));

      const filterUserStatusPromise = Promise.allSettled(accounts.map(async (account) => {
        try {
          const resp = await callOnOne(
            cluster,
            logger,
            async (client) => await asyncClientCall(client.user, "queryUserInAccountBlockStatus", {
              accountName: account, userId,
            }),
          );
          if (resp.blocked) {
            filteredBlockedUserAccounts.push(account);
          } else {
            filteredUnblockedUserAccounts.push(account);
          }
        } catch (error) {
          logger.error(`Error occured when query the block status of ${userId} in ${account}.`, error);
        }
      }));

      await Promise.allSettled([filterAccountPromise, filterUserStatusPromise]);

      const unblockAccounts =
        filteredUnblockedAccounts.filter((account) => filteredUnblockedUserAccounts.includes(account));
      const blockedAccounts = Array.from(new Set(filteredBlockedAccounts.concat(filteredBlockedUserAccounts)));

      return [{ accounts:
        statusFilter === AccountStatusFilter.BLOCKED_ONLY ? blockedAccounts : unblockAccounts }];
    },

    getJobTemplate: async ({ request, logger }) => {
      const { cluster, templateId, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      const reply = await clusterops.job.getJobTemplate({
        id: templateId, userId,
      }, logger);

      return [{ template: reply.template }];

    },

    listJobTemplates: async ({ request, logger }) => {

      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      const reply = await clusterops.job.listJobTemplates({
        userId,
      }, logger);

      return [{ results: reply.results.map((x) => ({ ...x, submitTime: x.submitTime?.toISOString() })) }];

    },

    deleteJobTemplate: async ({ request, logger }) => {
      const { cluster, templateId, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      await clusterops.job.deleteJobTemplate({
        id: templateId, userId,
      }, logger);

      return [{}];
    },

    renameJobTemplate: async ({ request, logger }) => {
      const { cluster, templateId, userId, jobName } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const clusterops = getClusterOps(cluster);

      if (!clusterops) { throw clusterNotFound(cluster); }

      await clusterops.job.renameJobTemplate({
        id: templateId, userId, jobName,
      }, logger);

      return [{}];
    },

    listRunningJobs: async ({ request, logger }) => {

      const { cluster, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.job, "getJobs", {
          fields: [
            "job_id", "partition", "name", "user", "state", "elapsed_seconds",
            "nodes_req", "node_list", "reason", "account", "cpus_req", "gpus_req",
            "qos", "submit_time", "time_limit_minutes", "working_directory",
          ],
          filter: { users: [userId], accounts: [], states: ["PENDING", "RUNNING"]},
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
        async (client) => await asyncClientCall(client.job, "getJobs", {
          fields: [
            "job_id", "name", "account", "partition", "qos", "state", "working_directory",
            "reason", "elapsed_seconds", "time_limit_minutes", "submit_time",
            "start_time", "end_time",
          ],
          filter: {
            users: [userId], accounts: [], states: [],
            submitTime: { startTime, endTime },
          },
        }),
      );

      return [{ results: reply.jobs.map(jobInfoToPortalJobInfo) }];

    },

    submitJob: async ({ request, logger }) => {
      const { cluster, userId, account, partition } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      // 管理系统存在时，增加用户账户封锁状态, 授权集群分区等鉴权
      if (config.MIS_DEPLOYED) {
        await validateSubmitJobInfoUnderMis({
          userId,
          accountName: account,
          clusterId: cluster,
          logger,
          partitionName: partition,
          checkAccountApp: false,
        });
      }

      const clusterOps = getClusterOps(cluster);
      if (!clusterOps) { throw clusterNotFound(cluster); }

      const { jobId } = await clusterOps.job.submitJob({ ...request }, logger);

      return [{ jobId }];
    },


    submitFileAsJob: async ({ request, logger }) => {
      const { cluster } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);
      if (!host) { throw clusterNotFound(cluster); }

      const clusterOps = getClusterOps(cluster);
      if (!clusterOps) { throw clusterNotFound(cluster); }

      const { jobId } = await clusterOps.job.submitFileAsJob({ ...request }, logger);

      return [{ jobId }];
    },

  });

});
