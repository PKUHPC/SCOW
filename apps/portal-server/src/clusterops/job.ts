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

import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { sftpExists, sftpReaddir, sftpReadFile, sftpUnlink, sftpWriteFile } from "@scow/lib-ssh";
import { join } from "path";
import { JobOps, JobTemplateInfo } from "src/clusterops/api/job";
import { portalConfig } from "src/config/portal";
import { getClusterLoginNode, sshConnect } from "src/utils/ssh";

export interface JobMetadata {
  jobName: string;
  account: string;
  partition?: string;
  qos?: string;
  nodeCount: number;
  coreCount: number;
  gpuCount?: number;
  maxTime: number;
  command: string;
  comment?: string;
  submitTime: string;
  workingDirectory: string;
  memory?: string;
  extraOptions: {
    [key: string]: string;
  }
}

export const jobOps = (cluster: string): JobOps => {

  const host = getClusterLoginNode(cluster);

  if (!host) { throw new Error(`Cluster ${cluster} has no login node`); }

  return {

    getJobTemplate: async (request, logger) => {
      const { id, userId } = request;

      return await sshConnect(host, userId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        const file = join(portalConfig.savedJobsDir, id);

        if (!await sftpExists(sftp, file)) {
          throw <ServiceError> { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` };
        }

        const content = await sftpReadFile(sftp)(file);
        logger.info("getJobTamplate to %s", content);
        const data = JSON.parse(content.toString()) as JobMetadata;

        return { template: data };
      });
    },

    listJobTemplates: async (request, logger) => {
      const { userId } = request;

      return await sshConnect(host, userId, logger, async (ssh) => {
        const sftp = await ssh.requestSFTP();

        if (!await sftpExists(sftp, portalConfig.savedJobsDir)) { return { results: []}; }

        const list = await sftpReaddir(sftp)(portalConfig.savedJobsDir);

        const results = await Promise.all(list.map(async ({ filename }) => {
          const content = await sftpReadFile(sftp)(join(portalConfig.savedJobsDir, filename));
          const data = JSON.parse(content.toString()) as JobMetadata;

          return {
            id: filename,
            submitTime: new Date(data.submitTime),
            comment: data.comment,
            jobName: data.jobName,
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
          throw <ServiceError> { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` };
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
          throw <ServiceError> { code: Status.NOT_FOUND, message: `Job template id ${id} is not found.` };
        }

        const content = await sftpReadFile(sftp)(file);
        const data = JSON.parse(content.toString()) as JobMetadata;
        data.jobName = jobName;

        await sftpWriteFile(sftp)(file, JSON.stringify(data));
        return {};
      });

    },
  };
};
