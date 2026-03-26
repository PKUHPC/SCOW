import { ConnectError } from "@connectrpc/connect";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { checkSchedulerApiVersion } from "@scow/lib-server";
import { TimeUnit } from "@scow/protos/build/portal/job";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import { ApiVersion } from "@scow/utils/build/version";
import path, { join } from "path";
import { JobOps, JobTemplate, JobTemplateInfo } from "src/clusterops/api/job";
import { portalConfig } from "src/config/portal";
import { callOnOne } from "src/utils/clusters";
import { mapConnectRpcStatusToGrpc } from "src/utils/scowd";

import { JobMetadata } from "./index";

export const scowdJobServices = (client: ScowdClient): JobOps => ({

  getJobTemplate: async (request, logger) => {
    const { id, userId } = request;

    try {
      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
      const filePath = join(userHomeDir, portalConfig.savedJobsDir, id);

      const { exists } = await client.file.exists({ userId, path: filePath });

      if (!exists) {
        throw { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` } as ServiceError;
      }

      const { content } = await client.file.readFile({ userId, filePath });

      logger.info("getJobTamplate to %s", content);

      try {
        const data = JSON.parse(content.toString()) as JobMetadata;
        return { template: data };
      } catch (error) {
        logger.error("Parsing JSON file %s failed, error is %o", filePath, error);
        throw { code: Status.INTERNAL, message: "Parsing JSON failed" } as ServiceError;
      }
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  listJobTemplates: async (request, logger) => {
    const { userId } = request;

    try {
      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;

      const { exists } = await client.file.exists({ userId, path: join(userHomeDir, portalConfig.savedJobsDir) });

      if (!exists) {
        return { results: []};
      }

      const { filesInfo } = await client.file.readDirectory({
        userId, dirPath: join(userHomeDir, portalConfig.savedJobsDir),
      });

      const results = await Promise.all(filesInfo.map(async ({ name }) => {
        const filePath = join(userHomeDir, portalConfig.savedJobsDir, name);
        const { content } = await client.file.readFile({ userId, filePath });

        let data: JobMetadata | object = {};

        try {
          data = JSON.parse(content.toString()) as JobMetadata;
        } catch (error) {
          logger.error("Parsing JSON file %s failed, the content is %s,the error is %o",
            filePath, content.toString(),error);
        }

        return {
          id: name,
          submitTime: ("submitTime" in data && data.submitTime) ? new Date(data.submitTime) : new Date(),
          comment: ("comment" in data && data.comment) ? data.comment : "",
          jobName: ("jobName" in data && data.jobName) ? data.jobName : "unknown",
        } as JobTemplateInfo;
      }));

      return { results };

    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  saveJobTemplate: async (request, logger) => {
    const { userId, jobId, jobInfo } = request;

    const id = `${jobInfo.jobName}-${jobId}`;
    logger.info("Save job to %s", id);

    try {
      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;

      const { exists } = await client.file.exists({ userId, path: join(userHomeDir, portalConfig.savedJobsDir) });

      if (!exists) {
        await client.file.makeDirectory({ userId, dirPath: join(userHomeDir, portalConfig.savedJobsDir) });
      }

      const filePath = join(userHomeDir, portalConfig.savedJobsDir, id);
      const metadata: JobMetadata = { ...jobInfo, submitTime: new Date().toISOString() };

      await client.file.writeFile({ userId, filePath, content: JSON.stringify(metadata) });

      logger.info("Saved job as template to %s", filePath);

      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  deleteJobTemplate: async (request) => {
    const { id, userId } = request;

    try {
      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
      const filePath = join(userHomeDir, portalConfig.savedJobsDir, id);

      const { exists } = await client.file.exists({ userId, path: filePath });

      if (!exists) {
        throw { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` } as ServiceError;
      }

      await client.file.deleteFile({ userId, filePath });

      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  renameJobTemplate: async (request, logger) => {
    const { id, userId, jobName } = request;

    try {
      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
      const filePath = join(userHomeDir, portalConfig.savedJobsDir, id);

      const { exists } = await client.file.exists({ userId, path: filePath });

      if (!exists) {
        throw { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` } as ServiceError;
      }

      const { content } = await client.file.readFile({ userId, filePath });
      try {
        const data = JSON.parse(content.toString()) as JobMetadata;
        data.jobName = jobName;

        await client.file.writeFile({ userId, filePath, content: JSON.stringify(data) });

        return {};
      } catch (error) {
        logger.error("Parsing JSON file %s failed, error is %o", filePath, error);
        throw { code: Status.INTERNAL, message: "Parsing JSON failed" } as ServiceError;
      }
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  submitJob: async (request, logger) => {
    const { cluster, command, jobName, coreCount, gpuCount, maxTime, maxTimeUnit = TimeUnit.MINUTES,
      saveAsTemplate, userId, nodeCount, partition, qos, account, workingDirectory, output
      , errorOutput, memory, scriptOutput } = request;

    try {
      // make sure working directory exists
      await client.file.makeDirectory({ userId, dirPath: workingDirectory });

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
        const scriptPath = join(workingDirectory, scriptOutput);

        await client.file.writeFile({ userId, filePath: scriptPath, content: reply.generatedScript });
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

        const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;

        const { exists } = await client.file.exists({ userId, path: join(userHomeDir, portalConfig.savedJobsDir) });

        if (!exists) {
          await client.file.makeDirectory({ userId, dirPath: join(userHomeDir, portalConfig.savedJobsDir) });
        }

        const id = `${jobInfo.jobName}-${reply.jobId}`;
        const filePath = join(userHomeDir, portalConfig.savedJobsDir, id);
        const metadata: JobMetadata = { ...jobInfo, submitTime: new Date().toISOString() };

        await client.file.writeFile({ userId, filePath, content: JSON.stringify(metadata) });

        logger.info("Saved job as template to %s", filePath);
      }
      return { jobId: reply.jobId };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },


  submitFileAsJob: async (request, logger) => {
    const { cluster, userId, filePath } = request;

    try {
      // make sure working directory exists
      const { sizeByte, mime } = await client.file.getFileMetadata({ userId, filePath });

      // 文件SIZE大于1M不能提交sbatch执行
      if (Number(sizeByte) / (1024 * 1024) > 1) {
        throw {
          code: Status.INVALID_ARGUMENT, message: `${filePath} is too large. Maximum file size is 1M`,
        } as ServiceError;
      }

      const isTextFile = /text/.exec(mime);
      // 文件不是文本文件不能提交Sbatch执行
      if (!isTextFile) {
        throw {
          code: Status.INVALID_ARGUMENT, message: `${filePath} is not a text file`,
        } as ServiceError;
      }

      const { content } = await client.file.readFile({ userId, filePath });

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
            userId, script: content.toString(), scriptFileFullPath,
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
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },
  saveAsJobTemplate: async (request, logger) => {
    const { userId, memoryMb, ...rest } = request;
    try {
      const jobInfo: JobTemplate = { ...rest, memory: memoryMb };

      logger.info("jobInfo: %o", jobInfo);

      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;

      const { exists } = await client.file.exists({ userId, path: join(userHomeDir, portalConfig.savedJobsDir) });

      if (!exists) {
        await client.file.makeDirectory({ userId, dirPath: join(userHomeDir, portalConfig.savedJobsDir) });
      }

      const submitTime = Date.now();
      const id = `${jobInfo.jobName}-${submitTime}`;
      const filePath = join(userHomeDir, portalConfig.savedJobsDir, id);
      const metadata: JobMetadata = { ...jobInfo, submitTime:submitTime.toString() };

      await client.file.writeFile({ userId, filePath, content: JSON.stringify(metadata) });

      logger.info("Saved job as template to %s", filePath);
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }

    return [{}];
  },
});
