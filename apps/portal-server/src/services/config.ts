import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getUserAccountsClusterPartitionsByAccount } from "@scow/lib-scow-resource/build/utils";
import {
  convertClusterConfigsToServerProtoType,
  libGetAccounts,
  libGetCurrentActivatedClusters,
  libGetUserInfo,
  NO_CLUSTERS,
} from "@scow/lib-server";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { ConfigServiceServer, ConfigServiceService, Partition } from "@scow/protos/build/common/config";
import {
  ConfigServiceServer as runTimeConfigServiceServer,
  ConfigServiceService as runTimeConfigServiceService,
} from "@scow/protos/build/portal/config";
import { AccountStatusFilter } from "@scow/protos/build/portal/job";
import { readFileSync } from "fs";
import { join } from "path";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
import { callOnOne, checkActivatedClusters, getAdapterClient } from "src/utils/clusters";

export const staticConfigServiceServer = plugin((server) => {
  return server.addService<ConfigServiceServer>(ConfigServiceService, {
    getClusterConfig: async ({ request, logger }) => {
      const { cluster } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      const reply = await callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.config, "getClusterConfig", {}),
      );

      return [reply];
    },

    getAvailablePartitionsForCluster: async ({ request, logger }) => {
      const { cluster, accountName, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      let availablePartitions: Partition[];
      try {
        const resp = await callOnOne(
          cluster,
          logger,
          async (client) =>
            await asyncClientCall(client.config, "getAvailablePartitions", {
              accountName,
              userId,
            }),
        );
        availablePartitions = resp.partitions;
      } catch (error) {
        logger.error(
          "Error occured when query the available partitions of %s in %s. Error %o",
          userId,
          accountName,
          error,
        );
        availablePartitions = [];
      }

      return [{ partitions: availablePartitions }];
    },

    getClusterConfigFiles: async ({ logger }) => {
      const clusterConfigs = getClusterConfigs(undefined, logger, ["hpc"]);
      const currentConfigClusterIds = Object.keys(clusterConfigs);
      if (currentConfigClusterIds.length === 0) {
        throw new ServiceError({
          code: status.INTERNAL,
          details: "Unable to find cluster configuration files. Please contact the system administrator.",
          metadata: scowErrorMetadata(NO_CLUSTERS),
        });
      }

      const clusterConfigsProto = convertClusterConfigsToServerProtoType(clusterConfigs);

      return [{ clusterConfigs: clusterConfigsProto }];
    },

    getApiVersion: async () => {
      const version = await JSON.parse(
        readFileSync(join(__dirname, "../../node_modules/@scow/protos/package.json"), "utf-8"),
      ).version;

      const [major, minor, patch] = version.split(".").map(Number);

      return [{ major, minor, patch }];
    },

    getClusterNodesInfo: async ({ request, logger }) => {
      const { nodeNames, cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterNodesInfo", {
          nodeNames: nodeNames || [],
        });
      });
      return [{ nodes: reply.nodes }];
    },
  });
});

export const runtimeConfigServiceServer = plugin((server) => {
  return server.addService<runTimeConfigServiceServer>(runTimeConfigServiceService, {
    getClusterInfo: async ({ request, logger }) => {
      const { cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterInfo", request);
      });

      return [reply];
    },

    getSummaryClusterInfo: async ({ request, logger }) => {
      const { accountNames, cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getSummaryClusterInfo", {
          accountNames: accountNames || [],
        });
      });

      return [reply];
    },

    /**
     * Deprecated Notice
     * This API function getClusterNodesInfo has been deprecated.
     * Use the new COMMON API function getClusterNodesInfo from ConfigServiceService from protos/common/config instead.
     * @deprecated
     */
    getClusterNodesInfo: async ({ request, logger }) => {
      const { nodeNames, cluster } = request;

      const reply = await callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterNodesInfo", {
          nodeNames: nodeNames || [],
        });
      });
      return [{ nodes: reply.nodes }];
    },

    /**
     * 获取可用账户下的可用集群
     */
    getAvailableAccountsAndClusters: async ({ request, logger }) => {
      const { userId } = request;

      const activatedClusters = config.MIS_DEPLOYED
        ? await libGetCurrentActivatedClusters(
            logger,
            configClusters,
            config.MIS_SERVER_URL,
            commonConfig.scowApi?.auth?.token,
          )
        : configClusters;
      const currentClusterIds = Object.keys(activatedClusters).filter((clusterId) =>
        Boolean(configClusters[clusterId]),
      );

      if (currentClusterIds.length === 0) {
        return [{ accountClusters: [] }];
      }

      const buildAccountClusters = async (
        clusterIds: string[],
        getClusterAccounts: (clusterId: string) => Promise<string[] | undefined>,
      ): Promise<Record<string, string[]>> => {
        const accountClusterMap = new Map<string, Set<string>>();
        const settledResults = await Promise.allSettled(
          clusterIds.map(async (clusterId) => {
            const clusterAccounts = await getClusterAccounts(clusterId);
            return { clusterId, clusterAccounts };
          }),
        );

        const failedClusterIds: string[] = [];

        settledResults.forEach((result, index) => {
          if (result.status !== "fulfilled") {
            failedClusterIds.push(clusterIds[index]);
            return;
          }

          const { clusterId, clusterAccounts } = result.value;
          if (!clusterAccounts?.length) {
            return;
          }

          clusterAccounts.forEach((account) => {
            if (!accountClusterMap.has(account)) {
              accountClusterMap.set(account, new Set());
            }
            accountClusterMap.get(account)!.add(clusterId);
          });
        });

        if (failedClusterIds.length > 0) {
          logger.warn(`Failed to get available accounts from clusters: ${failedClusterIds.join(",")}`);
        }

        return Object.fromEntries(
          Array.from(accountClusterMap.entries()).map(([account, clusters]) => [account, Array.from(clusters)]),
        ) as Record<string, string[]>;
      };

      const convertAccountClustersToGrpc = (accountClusters: Record<string, string[]>) => {
        return Object.entries(accountClusters).map(([account, clusters]) => ({
          accountName: account,
          clusters,
        }));
      };

      if (!commonConfig.scowResource?.enabled) {
        let misAccounts: string[] | undefined;
        if (config.MIS_DEPLOYED && commonConfig.scowApi?.auth?.token) {
          const { accounts } = await libGetAccounts(
            logger,
            userId,
            AccountStatusFilter.UNBLOCKED_ONLY,
            config.MIS_SERVER_URL,
            commonConfig.scowApi?.auth?.token,
          );
          misAccounts = accounts;
        }

        const accountClusters = await buildAccountClusters(currentClusterIds, async (clusterId) => {
          if (misAccounts) {
            return misAccounts;
          }

          const client = getAdapterClient(clusterId);
          if (!client) {
            logger.warn(`Cluster ${clusterId} not found when listing app available accounts.`);
            return undefined;
          }

          const response = await asyncClientCall(client.account, "listAccounts", { userId });
          return response.accounts ?? [];
        });

        return [{ accountClusters: convertAccountClustersToGrpc(accountClusters) }];
      }

      const userInfo = await libGetUserInfo(logger, userId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);
      const tenantName = userInfo.tenantName;

      const { accounts } = await libGetAccounts(
        logger,
        userId,
        AccountStatusFilter.UNBLOCKED_ONLY,
        config.MIS_SERVER_URL,
        commonConfig.scowApi?.auth?.token,
      );

      const assignedClusterPartitionsByAccount = await getUserAccountsClusterPartitionsByAccount(
        commonConfig.scowResource,
        accounts,
        tenantName,
      );

      const currentClusterSet = new Set(currentClusterIds);
      const clusterAccountMap = new Map<string, Set<string>>();

      Object.entries(assignedClusterPartitionsByAccount).forEach(([accountName, clusterPartitions]) => {
        Object.entries(clusterPartitions ?? {}).forEach(([clusterId, partitions]) => {
          if (!currentClusterSet.has(clusterId) || partitions.length === 0) {
            return;
          }

          if (!clusterAccountMap.has(clusterId)) {
            clusterAccountMap.set(clusterId, new Set());
          }
          clusterAccountMap.get(clusterId)!.add(accountName);
        });
      });

      const accountClusters = await buildAccountClusters(currentClusterIds, async (clusterId) => {
        return Array.from(clusterAccountMap.get(clusterId) ?? []);
      });

      return [{ accountClusters: convertAccountClustersToGrpc(accountClusters) }];
    },
  });
});
