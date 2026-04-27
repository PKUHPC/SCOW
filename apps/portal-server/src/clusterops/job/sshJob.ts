import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  createDirectoriesRecursively,
  sftpExists, sftpReaddir, sftpReadFile, sftpStat, sftpUnlink, sftpWriteFile
} from "@scow/lib-ssh";
import { TimeUnit } from "@scow/protos/build/portal/job";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import path, { join } from "path";
import { JobOps, JobTemplate, JobTemplateInfo } from "src/clusterops/api/job";
import { portalConfig } from "src/config/portal";
import { callOnOne } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getClusterLoginNode, sshConnect } from "src/utils/ssh";

import { JobMetadata } from "./index";

export const sshJobServices = (host: string): JobOps => ({

  getJobTemplate: async (request, logger) => {
    const { id, userId } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const file = join(portalConfig.savedJobsDir, id);

      if (!await sftpExists(sftp, file)) {
        throw { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` } as ServiceError;
      }

      const content = await sftpReadFile(sftp)(file);
      logger.info("getJobTamplate to %s", content);

      try {
        const data = JSON.parse(content.toString()) as JobMetadata;
        return { template: data };
      } catch (error) {
        logger.error("Parsing JSON failed, error is %o", error);
        throw {
          code: Status.INTERNAL,
          message: "Parsing JSON failed",
        } as ServiceError;
      }
    });
  },

  listJobTemplates: async (request, logger) => {
    const { userId } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      if (!await sftpExists(sftp, portalConfig.savedJobsDir)) { return { results: [] }; }

      const list = await sftpReaddir(sftp)(portalConfig.savedJobsDir);

      const results = await Promise.all(list.map(async ({ filename }) => {
        const content = await sftpReadFile(sftp)(join(portalConfig.savedJobsDir, filename));
        let data: JobMetadata | object = {};

        try {
          data = JSON.parse(content.toString()) as JobMetadata;
        } catch (error) {
          logger.error("Parsing JSON failed, the content is %s,the error is %o", content.toString(), error);
        }

        return {
          id: filename,
          submitTime: ("submitTime" in data && data.submitTime) ? new Date(data.submitTime) : new Date(),
          comment: ("comment" in data && data.comment) ? data.comment : "",
          jobName: ("jobName" in data && data.jobName) ? data.jobName : "unknown",
        } as JobTemplateInfo;
      }));

      return { results };
    });
  },

  saveJobTemplate: async (request, logger) => {
    const { userId, jobId, jobInfo } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const id = `${jobInfo.jobName}-${jobId}`;
      logger.info("Save job to %s", id);

      await ssh.mkdir(portalConfig.savedJobsDir);

      const filePath = join(portalConfig.savedJobsDir, id);
      const metadata: JobMetadata = { ...jobInfo, submitTime: new Date().toISOString() };
      await sftpWriteFile(sftp)(filePath, JSON.stringify(metadata));

      logger.info("Saved job as template to %s", filePath);

      return {};
    });

  },

  deleteJobTemplate: async (request, logger) => {
    const { id, userId } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const file = join(portalConfig.savedJobsDir, id);

      if (!await sftpExists(sftp, file)) {
        throw { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` } as ServiceError;
      }

      await sftpUnlink(sftp)(file);

      return {};
    });

  },

  renameJobTemplate: async (request, logger) => {
    const { id, userId, jobName } = request;

    return await sshConnect(host, userId, logger, async (ssh) => {
      const sftp = await ssh.requestSFTP();

      const file = join(portalConfig.savedJobsDir, id);

      if (!await sftpExists(sftp, file)) {
        throw { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` } as ServiceError;
      }

      const content = await sftpReadFile(sftp)(file);

      try {
        const data = JSON.parse(content.toString()) as JobMetadata;
        data.jobName = jobName;


        await sftpWriteFile(sftp)(file, JSON.stringify(data));
        return {};
      } catch (error) {
        logger.error("Parsing JSON file %s failed, error is %o", file, error);
        throw { code: Status.INTERNAL, message: "Parsing JSON failed" } as ServiceError;
      }
    });
  },

  submitJob: async (request, logger) => {
    const { cluster, command, jobName, coreCount, gpuCount, maxTime, maxTimeUnit = TimeUnit.MINUTES,
      saveAsTemplate, userId, nodeCount, partition, qos, account, workingDirectory, output
      , errorOutput, memory, scriptOutput } = request;

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
        envVariables: [],
      }).catch((e) => {
        const ex = e as ServiceError;

        const { findDetails } = parseErrorStatus(ex.metadata);

        const errors = findDetails(ErrorInfo);

        if (errors.find((x) => x.reason === "SBATCH_FAILED")) {
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
        memory,
        maxTimeUnit,
      };

      logger.info("jobInfo: %o", jobInfo);

      await sshConnect(host, userId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const id = `${jobInfo.jobName}-${reply.jobId}`;
        logger.info("Save job to %s", id);

        await ssh.mkdir(portalConfig.savedJobsDir);

        const filePath = join(portalConfig.savedJobsDir, id);
        const metadata: JobMetadata = { ...jobInfo, submitTime: new Date().toISOString() };
        await sftpWriteFile(sftp)(filePath, JSON.stringify(metadata));

        logger.info("Saved job as template to %s", filePath);

        return {};
      });
    }
    return { jobId: reply.jobId };
  },


  submitFileAsJob: async (request, logger) => {
    const { cluster, userId, filePath } = request;

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
        return await asyncClientCall(client.job, "submitScriptAsJob", {
          userId, script, scriptFileFullPath,
        }).catch((e) => {
          const ex = e as ServiceError;
          const { findDetails } = parseErrorStatus(ex.metadata);

          const errors = findDetails(ErrorInfo);

          if (errors.find((x) => x.reason === "SBATCH_FAILED")) {
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

    return { jobId: reply.jobId };
  },
  saveAsJobTemplate: async () => {
    throw {
      code: Status.UNIMPLEMENTED,
      message: "saveAsJobTemplate is not implemented for ssh job service",
    } as ServiceError;
  },
});
