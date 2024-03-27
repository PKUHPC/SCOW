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
import {
  getUserHomedir,
  sftpWriteFile,
} from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { join } from "path";
import { JobType } from "src/models/Job";
import { aiConfig } from "src/server/config/ai";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity } from "src/server/utils/app";
import { getAdapterClient } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { getClusterLoginNode, sshConnect } from "src/server/utils/ssh";
import { isParentOrSameFolder } from "src/utils/file";
import { z } from "zod";

const SESSION_METADATA_NAME = "session.json";

const ImageSchema = z.object({
  name: z.string(),
  tag: z.string().optional(),
});

export type Image = z.infer<typeof ImageSchema>

interface SessionMetadata {
  sessionId: string;
  jobId: number;
  appId?: string;
  submitTime: string;
  image: Image;
  jobType: JobType
}

export const trainJob =
procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/jobs",
      tags: ["jobs"],
      summary: "Submit A Train Job",
    },
  })
  .input(z.object({
    clusterId: z.string(),
    trainJobName: z.string(),
    algorithm: z.number().optional(),
    imageId: z.number().optional(),
    remoteImageUrl: z.string().optional(),
    dataset: z.number().optional(),
    model: z.number().optional(),
    mountPoint: z.string().optional(),
    account: z.string(),
    partition: z.string().optional(),
    coreCount: z.number(),
    nodeCount: z.number(),
    gpuCount: z.number().optional(),
    memory: z.number().optional(),
    maxTime: z.number(),
    command: z.string(),
  }))
  .output(z.object({
    jobId: z.number(),
  })).mutation(
    async ({ input, ctx: { user } }) => {

      const { clusterId, trainJobName, algorithm, imageId, remoteImageUrl,
        dataset, model, mountPoint, account, partition,
        coreCount, nodeCount, gpuCount, memory, maxTime, command } = input;
      const userId = user.identityId;

      const host = getClusterLoginNode(clusterId);
      if (!host) {
        throw clusterNotFound(clusterId);
      }

      const em = await forkEntityManager();
      const {
        datasetVersion,
        algorithmVersion,
        modelVersion,
        image,
      } = await checkCreateAppEntity({
        em,
        dataset,
        algorithm,
        image: imageId,
        model,
      });

      return await sshConnect(host, userId, logger, async (ssh) => {

        const homeDir = await getUserHomedir(ssh, userId, logger);

        if (mountPoint && !isParentOrSameFolder(homeDir, mountPoint)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "mountPoint should be in homeDir",
          });
        }

        const trainJobsDirectory = join(aiConfig.appJobsDir, trainJobName);

        // make sure trainJobsDirectory exists.
        await ssh.mkdir(trainJobsDirectory);
        const sftp = await ssh.requestSFTP();
        const remoteEntryPath = join(homeDir, trainJobsDirectory, "entry.sh");

        const entryScript = command;
        await sftpWriteFile(sftp)(remoteEntryPath, entryScript);

        const client = getAdapterClient(clusterId);
        const reply = await asyncClientCall(client.job, "submitJob", {
          userId,
          jobName: trainJobName,
          algorithm: algorithmVersion?.path,
          image: remoteImageUrl || image?.path,
          dataset: datasetVersion?.path,
          model: modelVersion?.path,
          mountPoint,
          account,
          partition: partition!,
          coreCount,
          nodeCount,
          gpuCount: gpuCount ?? 0,
          memoryMb: Number(memory),
          timeLimitMinutes: maxTime,
          workingDirectory: trainJobsDirectory,
          script: remoteEntryPath,
          // 约定第一个参数确定是创建应用or训练任务，第二个参数为创建应用时的appId
          extraOptions: [JobType.TRAIN],
        }).catch((e) => {
          const ex = e as ServiceError;
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Submit train job failed, ${ex.details}`,
          });
        });

        const metadata: SessionMetadata = {
          jobId: reply.jobId,
          sessionId: trainJobName,
          submitTime: new Date().toISOString(),
          image: {
            name: image!.name,
            tag: image!.tag,
          },
          jobType: JobType.TRAIN,
        };
        await sftpWriteFile(sftp)(join(trainJobsDirectory, SESSION_METADATA_NAME), JSON.stringify(metadata));
        return { jobId: reply.jobId };

      });

    },
  );

export const cancelJob =
procedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/jobs/{jobId}",
      tags: ["jobs"],
      summary: "Cancel Train Job or App Session",
    },
  })
  .input(z.object({
    cluster: z.string(),
    jobId: z.number(),
  }))
  .output(z.void())
  .mutation(async ({ input, ctx: { user } }) => {

    const { cluster, jobId } = input;

    const userId = user.identityId;
    const client = getAdapterClient(cluster);
    await asyncClientCall(client.job, "cancelJob", {
      userId,
      jobId,
    });
  });
