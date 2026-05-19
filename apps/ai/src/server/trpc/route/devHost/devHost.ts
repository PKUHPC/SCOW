import { OperationResult, OperationType } from "@scow/lib-operation-log";
import { TRPCError } from "@trpc/server";
import { clusters } from "src/server/config/clusters";
import { callLog } from "src/server/setup/operationLog";
import { driver } from "src/server/trpc/Driver";
import { procedure } from "src/server/trpc/procedure/base";
import { checkCreateAppEntity, checkEntityAuth, hasNonUtf8Segment } from "src/server/utils/app";
import { checkClusterAvailable, getCurrentClusters } from "src/server/utils/clusters";
import { forkEntityManager } from "src/server/utils/getOrm";
import { logger } from "src/server/utils/logger";
import { parseIp } from "src/utils/parse";
import { z } from "zod";

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
});

export type CreateDevHostInput = z.infer<typeof CreateDevHostInputSchema>;

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
    const { clusterId, devHostName, image, maxTimeMinutes, mountPoints } = input;

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
        message: "The length of trainJobName should not exceed 42",
      });
    }

    if (devHostConfig.maxRunningTimeHours) {
      if (maxTimeMinutes > devHostConfig.maxRunningTimeHours * 60) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `The dev host running time cannot exceed ${devHostConfig.maxRunningTimeHours}` +
            ` hour${devHostConfig.maxRunningTimeHours > 1 ? "s" : ""}`,
        });
      }
      if (maxTimeMinutes === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The dev host running time cannot be 0",
        });
      }
    }

    if (mountPoints?.some((mountPoint) => hasNonUtf8Segment(mountPoint.path))) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Files or folders with non-UTF-8 names cannot be selected",
      });
    }

    const userId = user.identityId;

    const currentClusterIds = await getCurrentClusters(userId);
    checkClusterAvailable(currentClusterIds, clusterId);

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

    return { devHostId };
  });
