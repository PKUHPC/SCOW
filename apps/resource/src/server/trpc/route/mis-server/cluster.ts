import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { Cluster } from "@scow/config/build/type";
import { getClusterConfigsTypeFormat } from "@scow/lib-web/build/utils/typeConversion";
import { ConfigServiceClient as CommonConfigClient } from "@scow/protos/build/common/config";
import { ClusterActivationStatus, ConfigServiceClient } from "@scow/protos/build/server/config";
import { getScowActivatedClusters } from "src/server/mis-server/cluster";
import { authProcedure } from "src/server/trpc/procedure/base";
import { mock, MOCK_ACTIVATED_CLUSTER_INFO, MOCK_CLUSTER_PARTITIONS_INFO } from "src/server/trpc/route/mock";
import {
  checkClusterIdAvailable,
  isResourceAdmin,
  NoAvailableClustersError,
  UserForbiddenError,
} from "src/utils/auth/utils";
import { getClusterUtils } from "src/utils/clusterAdapter";
import { logger } from "src/utils/logger";
import { getScowClient } from "src/utils/scowClient";
import { z } from "zod";

export const I18nStringSchema = z.union([
  z.string(),
  z.object({
    i18n: z.object({
      default: z.string(),
      en: z.string().optional(),
      zh_cn: z.string().optional(),
    }),
  }),
]);

export const ClusterSchema = z.object({
  id: z.string(),
  name: I18nStringSchema,
});

export type ClusterWithName = z.infer<typeof ClusterSchema>;

export const currentClusters = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/currentClusters",
      tags: ["mis-server"],
      summary: "获取当前可用集群",
    },
  })
  .input(z.void())
  .output(z.object({ results: z.array(ClusterSchema) }))
  .query(async () => {
    return mock(
      async () => {
        const commonConfigClient = getScowClient(CommonConfigClient);
        const serverConfigClient = getScowClient(ConfigServiceClient);

        const clusterConfigFilesInfo = await asyncClientCall(commonConfigClient, "getClusterConfigFiles", {});

        const modifiedClustersInfo: Record<string, ClusterConfigSchema> = getClusterConfigsTypeFormat(
          clusterConfigFilesInfo.clusterConfigs,
        );

        const clustersRuntimeInfo = await asyncClientCall(serverConfigClient, "getClustersRuntimeInfo", {});

        const activatedRuntimeInfo = clustersRuntimeInfo.results.filter(
          (x) => x.activationStatus === ClusterActivationStatus.ACTIVATED,
        );
        const activatedClusters: Cluster[] = activatedRuntimeInfo.map((item) => {
          return {
            id: item.clusterId,
            name: modifiedClustersInfo[item.clusterId].displayName,
          };
        });

        return { results: activatedClusters };
      },
      async () => {
        return { results: MOCK_ACTIVATED_CLUSTER_INFO };
      },
    );
  });

export const PartitionInfoSchema = z.object({
  name: z.string(),
  memMb: z.number(),
  cores: z.number(),
  gpus: z.number(),
  nodes: z.number(),
  qos: z.array(z.string()),
  comment: z.optional(z.string()),
});
export type PartitionInfoSchema = z.infer<typeof PartitionInfoSchema>;

export const clusterPartitionsInfo = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/clusterPartitions",
      tags: ["mis-server"],
      summary: "从适配器获取当前集群的分区信息",
    },
  })
  .input(
    z.object({
      clusterId: z.string(),
    }),
  )
  .output(
    z.object({
      schedulerName: z.string(),
      partitions: z.array(PartitionInfoSchema),
    }),
  )
  .query(async ({ input }) => {
    return mock(
      async () => {
        const { clusterId } = input;

        // 检查当前请求集群是否可用
        await checkClusterIdAvailable(clusterId);

        const clustersUtil = await getClusterUtils();

        const result = await clustersUtil.callOnOne(clusterId, logger, async (adapterClient) => {
          return await asyncClientCall(adapterClient.config, "getClusterConfig", {});
        });

        return [result];
      },
      async () => {
        return MOCK_CLUSTER_PARTITIONS_INFO as any;
      },
    );
  });

export const ClusterPartition = z.object({
  clusterId: z.string(),
  partition: z.string(),
});
export type ClusterPartition = z.infer<typeof ClusterPartition>;

export const currentClustersPartitionsInfo = authProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/clusterPartitions",
      tags: ["mis-server"],
      summary: "从适配器获取当前集群的分区信息",
    },
  })
  .input(z.void())
  .output(z.array(ClusterPartition))
  .query(async ({ ctx: { user } }) => {
    return mock(
      async () => {
        if (!isResourceAdmin(user)) {
          throw new UserForbiddenError(user.identityId);
        }

        // 获取当前在线中的集群
        const currentClusters = await getScowActivatedClusters();
        if (!currentClusters || currentClusters.length === 0) {
          throw new NoAvailableClustersError();
        }
        const currentClusterIds = currentClusters.map((c) => c.id);

        const clusterPartitions: ClusterPartition[] = [];
        const clustersUtil = await getClusterUtils();
        const results = await Promise.allSettled(
          currentClusterIds.map(async (clusterId) => {
            const configInfo = await clustersUtil.callOnOne(clusterId, logger, async (client) => {
              return await asyncClientCall(client.config, "getClusterConfig", {});
            });

            if (configInfo) {
              const partitions: ClusterPartition[] = configInfo.partitions.map((x) => ({
                clusterId,
                partition: x.name,
              }));
              clusterPartitions.push(...partitions);
            }
          }),
        );

        const errors = results.reduce((acc: { clusterId: string; reason: any }[], result, index) => {
          if (result.status === "rejected") {
            acc.push({ clusterId: currentClusterIds[index], reason: result.reason });
          }
          return acc;
        }, []);

        if (errors.length > 0) {
          const errorDetails = errors
            .map((error) => {
              return `Cluster: ${error?.clusterId}, Reason: ${
                error?.reason.message || error?.reason.details || error?.reason
              }`;
            })
            .join("; ");
          logger.warn(`Failed to get cluster partitions for some clusters: ${errorDetails}`);
        }

        return clusterPartitions;
      },
      async () => {
        return [
          { clusterId: "hpc01", partition: "cpu1" },
          { clusterId: "hpc01", partition: "compute" },
          { clusterId: "hpc01", partition: "gpu" },
          { clusterId: "hpc02", partition: "gpu1" },
          { clusterId: "hpc02", partition: "gpu" },
          { clusterId: "hpc02", partition: "compute" },
        ] as any;
      },
    );
  });
