import { ConnectError } from "@connectrpc/connect";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ScowdClient } from "@scow/lib-scowd/build/client";
import { TimeUnit } from "@scow/protos/build/portal/job";
import { ErrorInfo, parseErrorStatus } from "@scow/rich-error-model";
import path, { join } from "path";
import { JobOps, JobTemplate } from "src/clusterops/api/job";
import { portalConfig } from "src/config/portal";
import { callOnOne } from "src/utils/clusters";
import { mapConnectRpcStatusToGrpc } from "src/utils/scowd";

import { JobMetadata } from "./index";
import { resolveSubmitJobWorkingDirectory } from "./workingDirectory";

export const scowdJobServices = (getClient: (userId: string) => ScowdClient): JobOps => ({
  submitJob: async (request, logger) => {
    const {
      cluster,
      command,
      jobName,
      coreCount,
      gpuCount,
      maxTime,
      maxTimeUnit = TimeUnit.MINUTES,
      saveAsTemplate,
      userId,
      nodeCount,
      partition,
      qos,
      account,
      workingDirectory,
      output,
      errorOutput,
      memory,
      scriptOutput,
    } = request;
    const client = getClient(userId);
    logger.info("Submitting job %s for user %s in cluster %s", jobName, userId, cluster);

    try {
      const userHomeDir = (await client.file.getHomeDirectory({ userId })).path;
      const resolvedWorkingDirectory = resolveSubmitJobWorkingDirectory(workingDirectory, userHomeDir);

      // make sure working directory exists
      await client.file.makeDirectory({ userId, dirPath: resolvedWorkingDirectory });

      const timeUnitConversion = {
        [TimeUnit.MINUTES]: 1,
        [TimeUnit.HOURS]: 60,
        [TimeUnit.DAYS]: 60 * 24,
      };
      const maxTimeConversion = maxTime * timeUnitConversion[maxTimeUnit];
      const reply = await callOnOne(
        cluster,
        logger,
        async (client) =>
          await asyncClientCall(client.job, "submitJob", {
            userId,
            jobName,
            account,
            partition: partition,
            qos,
            nodeCount,
            gpuCount: gpuCount ?? 0,
            memoryMb: Number(memory?.split("M")[0]),
            coreCount,
            timeLimitMinutes: maxTimeConversion,
            script: command,
            workingDirectory: resolvedWorkingDirectory,
            stdout: output,
            stderr: errorOutput,
            extraOptions: [],
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
        const scriptPath = join(resolvedWorkingDirectory, scriptOutput);

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
    const client = getClient(userId);
    logger.info("Submitting file %s as job for user %s in cluster %s", filePath, userId, cluster);

    try {
      // make sure working directory exists
      const { sizeByte, mime } = await client.file.getFileMetadata({ userId, filePath });

      // 文件SIZE大于1M不能提交sbatch执行
      if (Number(sizeByte) / (1024 * 1024) > 1) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: `${filePath} is too large. Maximum file size is 1M`,
        } as ServiceError;
      }

      const isTextFile = /text/.exec(mime);
      // 文件不是文本文件不能提交Sbatch执行
      if (!isTextFile) {
        throw {
          code: Status.INVALID_ARGUMENT,
          message: `${filePath} is not a text file`,
        } as ServiceError;
      }

      const { content } = await client.file.readFile({ userId, filePath });

      const scriptFileFullPath = path.dirname(filePath);

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.job, "submitScriptAsJob", {
          userId,
          script: content.toString(),
          scriptFileFullPath,
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
      });

      return { jobId: reply.jobId };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },
});
