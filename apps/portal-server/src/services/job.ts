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
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { jobInfoToPortalJobInfo, jobInfoToRunningjob } from "@scow/lib-scheduler-adapter";
import { checkSchedulerApiVersion, compareSchedulerApiVersion, getSchedulerApiVersion } from "@scow/lib-server";
import { createDirectoriesRecursively, sftpReadFile, sftpStat, sftpWriteFile } from "@scow/lib-ssh";
import { AccountStatusFilter, JobServiceServer, JobServiceService, TimeUnit } from "@scow/protos/build/portal/job";
import { parseErrorDetails } from "@scow/rich-error-model";
import { ApiVersion } from "@scow/utils/build/version";
import path, { join } from "path";
import { getClusterOps } from "src/clusterops";
import { JobTemplate } from "src/clusterops/api/job";
import { callOnOne, checkActivatedClusters } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getClusterLoginNode, sshConnect } from "src/utils/ssh";

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
            "nodes_alloc", "node_list", "reason", "account", "cpus_alloc", "gpus_alloc",
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
      const { cluster, command, jobName, coreCount, gpuCount, maxTime, maxTimeUnit = TimeUnit.MINUTES,
        saveAsTemplate, userId, nodeCount, partition, qos, account, comment, workingDirectory, output
        , errorOutput, memory, scriptOutput } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      // 检查作业重名的最低调度器接口版本
      const minRequiredApiVersion: ApiVersion = { major: 1, minor: 6, patch: 0 };

      const scheduleApiVersion = await callOnOne(
        cluster,
        logger,
        async (client) => await getSchedulerApiVersion(client),
      );

      // 适配器支持的话就检查是否存在同名的作业
      if (compareSchedulerApiVersion(scheduleApiVersion,minRequiredApiVersion)) {

        const existingJobName = await callOnOne(
          cluster,
          logger,
          async (client) => await asyncClientCall(client.job, "getJobs", {
            fields: ["job_id"],
            filter: {
              users: [userId], accounts: [], states: [], jobName,
            },
          }),
        ).then((resp) => resp.jobs);

        if (existingJobName.length) {
          throw {
            code: Status.ALREADY_EXISTS,
            message: "already exists",
            details: `jobName ${jobName} is already existed`,
          } as ServiceError;
        }

      } else {
        logger.info("Adapter version lower than 1.6.0, do not perform check for duplicate job names");
      }

      // make sure working directory exists
      const host = getClusterLoginNode(cluster);
      if (!host) { throw clusterNotFound(cluster); }
      await sshConnect(host, userId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();
        await createDirectoriesRecursively(sftp, workingDirectory);
      });
      const timeUnitConversion = {
        [TimeUnit.MINUTES]: 1,
        [TimeUnit.HOURS]: 60,
        [TimeUnit.DAYS]: 60 * 24,
      };
      const maxTimeConversion = maxTime * (timeUnitConversion[maxTimeUnit]);
      const reply = await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.job, "submitJob", {
          userId, jobName, account, partition: partition, qos, nodeCount, gpuCount: gpuCount ?? 0,
          memoryMb: Number(memory?.split("M")[0]), coreCount, timeLimitMinutes: maxTimeConversion,
          script: command, workingDirectory, stdout: output, stderr: errorOutput, extraOptions: [],
        }).catch((e) => {
          const ex = e as ServiceError;
          const errors = parseErrorDetails(ex.metadata);
          if (errors[0] && errors[0].$type === "google.rpc.ErrorInfo" && errors[0].reason === "SBATCH_FAILED") {
            throw {
              code: Status.INTERNAL,
              message: "sbatch failed",
              details: ex.details,
            } as ServiceError;
          } else {
            throw e;
          }
        }),
      );

      // 保存作业脚本
      if (scriptOutput) {
        await sshConnect(host, userId, logger, async (ssh) => {
          const sftp = await ssh.requestSFTP();
          const scriptPath = join(workingDirectory, scriptOutput);
          await sftpWriteFile(sftp)(scriptPath, reply.generatedScript);
        });
      }

      if (saveAsTemplate) {
        const jobInfo: JobTemplate = {
          jobName,
          coreCount,
          maxTime,
          nodeCount,
          gpuCount,
          partition,
          qos,
          account,
          command,
          comment,
          workingDirectory,
          output,
          errorOutput,
          memory,
          scriptOutput,
          maxTimeUnit,
        };


        const clusterOps = getClusterOps(cluster);
        if (!clusterOps) { throw clusterNotFound(cluster); }

        logger.info("jobInfo: %o", jobInfo);
        await clusterOps.job.saveJobTemplate({
          userId, jobId: reply.jobId, jobInfo,
        }, logger);
      }
      return [{ jobId: reply.jobId }];
    },


    submitFileAsJob: async ({ request, logger }) => {
      const { cluster, userId, filePath } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const host = getClusterLoginNode(cluster);
      if (!host) { throw clusterNotFound(cluster); }

      const script = await sshConnect(host, userId, logger, async (ssh) => {

        const sftp = await ssh.requestSFTP();

        // 判断文件操作权限
        const stat = await sftpStat(sftp)(filePath).catch((e) => {
          logger.error(e, "stat %s as %s failed", filePath, userId);
          throw {
            code: Status.PERMISSION_DENIED, message: `${filePath} is not accessible`,
          } as ServiceError;
        });
        // 文件SIZE大于1M不能提交sbatch执行
        if (stat.size / (1024 * 1024) > 1) {
          throw {
            code: Status.INVALID_ARGUMENT, message: `${filePath} is too large. Maximum file size is 1M`,
          } as ServiceError;
        }

        const isTextFile = await ssh.exec("file", [filePath]).then((res) => {
          return /text/.exec(res);
        });
        // 文件不是文本文件不能提交Sbatch执行
        if (!isTextFile) {
          throw {
            code: Status.INVALID_ARGUMENT, message: `${filePath} is not a text file`,
          } as ServiceError;
        }

        return await sftpReadFile(sftp)(filePath)
          .then((buffer) => {
            return buffer.toString("utf-8");
          });
      });

      const scriptFileFullPath = path.dirname(filePath);

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) => {

          // 当前接口要求的最低调度器接口版本
          const minRequiredApiVersion: ApiVersion = { major: 1, minor: 5, patch: 0 };

          // 检验调度器的API版本是否符合要求，不符合要求报错
          await checkSchedulerApiVersion(client, minRequiredApiVersion);

          return await asyncClientCall(client.job, "submitScriptAsJob", {
            userId, script, scriptFileFullPath,
          }).catch((e) => {
            const ex = e as ServiceError;
            const errors = parseErrorDetails(ex.metadata);
            if (errors[0] && errors[0].$type === "google.rpc.ErrorInfo" && errors[0].reason === "SBATCH_FAILED") {
              throw {
                code: Status.INTERNAL,
                message: "sbatch failed",
                details: ex.details,
              } as ServiceError;
            } else {
              throw e;
            }
          });
        },

      );

      return [{ jobId: reply.jobId }];
    },

  });

});
