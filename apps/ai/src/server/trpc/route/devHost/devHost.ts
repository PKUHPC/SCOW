import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { JobType } from "src/models/Job";
import { clusters } from "src/server/config/clusters";
import { AiJobSubmitRecord } from "src/server/entities/AiJobSubmitRecord";
import { callLog } from "src/server/setup/operationLog";
import { driver } from "src/server/trpc/Driver";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, checkEntityAuth, hasNonUtf8Segment, validateRemoteImageUrl } from "src/server/utils/app";
import { checkClusterAvailable, getCurrentClusters } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { AIJobLabelType, validateMaxRunningTimeMinutes } from "src/server/utils/maxRunningTime";
import { fetchSubmitRecord } from "src/server/utils/submitRecord";
import { validateSubmitAiJobInfoUnderMis } from "src/server/utils/validation";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

import { EnvVariableSchema } from "../jobs/jobs";

export const CreateDevHostInputSchema = z.object({
  clusterId: z.string(),
  devHostName: z.string(),
  image: z.number().optional(),
  isImagePrivate: z.boolean().optional(),
  remoteImageUrl: z.string().optional(),
  mountPoints: z
    .array(
      z.object({
        path: z.string(),
        target: z.string(),
      }),
    )
    .optional(),
  account: z.string(),
  partition: z.string(),
  qos: z.string(),
  coreCount: z.number(),
  gpuCount: z.number().optional(),
  memory: z.number(),
  maxTimeMinutes: z.number(),
  privateImageRepositoryCredentials: z
    .object({
      userName: z.string(),
      password: z.string(),
    })
    .optional(),
  envVariables: z.array(EnvVariableSchema).optional(),
});

export type CreateDevHostInput = z.infer<typeof CreateDevHostInputSchema>;

export const DevSubmitRecordFormDataSchema = CreateDevHostInputSchema.omit({
  clusterId: true,
  account: true,
  privateImageRepositoryCredentials: true,
});

export const createDevHost = procedure
  .meta({
    openapi: {
      method: "POST",
      path: "/devHost",
      tags: ["devHost"],
      summary: "Create A Dev Host",
    },
  })
  .input(CreateDevHostInputSchema)
  .output(
    z.object({
      devHostId: z.number(),
    }),
  )
  .use(async ({ input: { clusterId }, ctx, next }) => {
    const res = await next({ ctx });

    const { user, req } = ctx;
    const logInfo = {
      operatorUserId: user.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.createDevHost,
    };

    if (res.ok) {
      await callLog(
        { ...logInfo, operationTypePayload: { clusterId, devHostId: (res.data as any).devHostId } },
        OperationResult.SUCCESS,
      );
    }

    if (!res.ok) {
      await callLog({ ...logInfo, operationTypePayload: { clusterId } }, OperationResult.FAIL);
    }

    return res;
  })
  .mutation(async ({ input, ctx: { user } }) => {
    const { clusterId, devHostName, image, maxTimeMinutes, mountPoints, account, partition, remoteImageUrl } = input;

    const devHostConfig = clusters[clusterId]?.ai?.devHost;
    if (!devHostConfig?.enabled) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Dev host is not enabled in this cluster",
      });
    }

    if (devHostName.length > 42) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The length of devHostName should not exceed 42",
      });
    }

    validateMaxRunningTimeMinutes(maxTimeMinutes, devHostConfig.maxRunningTimeHours, AIJobLabelType.devHost);
    validateRemoteImageUrl(remoteImageUrl);

    if (mountPoints?.some((mountPoint) => hasNonUtf8Segment(mountPoint.path))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Files or folders with non-UTF-8 names cannot be selected",
      });
    }

    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    await validateSubmitAiJobInfoUnderMis({
      userId,
      accountName: account,
      clusterId,
      logger,
      partitionName: partition,
      checkAccountApp: false,
    });

    const em = await forkEntityManager();
    const { image: existImage } = await checkCreateAppEntity({ em, image, datasets: [], algorithms: [], models: [] });

    // 检查数据集、算法、模型和镜像是否有权限使用
    checkEntityAuth({ userId, image: existImage, datasetVersions: [], algorithmVersions: [], modelVersions: [] });

    const devHostId = await driver.withJobDriver(
      {
        clusterId,
        user: userId,
      },
      async (jobDriver) => {
        return await jobDriver.createDevHost(input, { existImage });
      },
      logger,
    );

    const {
      clusterId: _cid,
      account: submittedAccount,
      privateImageRepositoryCredentials: _cred,
      ...rawFormData
    } = input;
    const parsedFormData = DevSubmitRecordFormDataSchema.safeParse(rawFormData);
    if (!parsedFormData.success) {
      logger.warn("Failed to parse dev host form data for jobId %s: %o", devHostId, parsedFormData.error);
    } else {
      try {
        await em.persistAndFlush(
          new AiJobSubmitRecord({
            userId,
            jobType: JobType.DEV_HOST,
            jobId: devHostId,
            cluster: clusterId,
            account: submittedAccount,
            formData: parsedFormData.data,
          }),
        );
      } catch (e) {
        logger.warn("Failed to save dev host job submit record for jobId %s: %o", devHostId, e);
      }
    }

    return { devHostId };
  });

export const getCreateDevParams = procedure
  .meta({
    openapi: {
      method: "GET",
      path: "/devHost/{jobId}/submissionParameters",
      tags: ["devHost"],
      summary: "Get Create Dev Host Parameters",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
      jobId: z.number(),
      sessionId: z.string(),
    }),
  )
  .output(CreateDevHostInputSchema)
  .query(async ({ input, ctx: { user } }) => {
    const { clusterId, jobId, sessionId } = input;
    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

    const em = await forkEntityManager();
    return fetchSubmitRecord(
      em,
      userId,
      clusterId,
      jobId,
      CreateDevHostInputSchema,
      async () => {
        return driver.withJobDriver({ clusterId, user: userId }, (d) => d.getDevHostParams(sessionId, jobId), logger);
      },
      logger,
    );
  });
