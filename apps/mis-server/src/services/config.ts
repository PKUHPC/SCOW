import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { ClusterEntryPathsConfigError, getClusterConfigs } from "@scow/config/build/cluster";
import { StorageConfigValidationError } from "@scow/config/build/storage";
import { convertClusterConfigsToServerProtoType, NO_CLUSTERS } from "@scow/lib-server";
import { CLUSTER_CONFIG_VALIDATION_ERROR, scowErrorMetadata, STORAGE_CONFIG_VALIDATION_ERROR } from "@scow/lib-server/build/error";
import { libCheckActivatedClusters } from "@scow/lib-server/build/misCommon/clustersActivation";
import { ConfigServiceServer, ConfigServiceService } from "@scow/protos/build/common/config";
import { readFileSync } from "fs";
import { join } from "path";
import { getActivatedClusters, updateCluster } from "src/bl/clustersUtils";

export const configServiceServer = plugin((server) => {
  server.addService<ConfigServiceServer>(ConfigServiceService, {
    // do not need check cluster's activation
    getClusterConfig: async ({ request, logger }) => {
      const { cluster } = request;

      const reply = await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) => await asyncClientCall(client.config, "getClusterConfig", {}),
      );

      return [reply];
    },

    getAvailablePartitionsForCluster: async ({ request, em, logger }) => {
      const { cluster, accountName, userId } = request;

      // check cluster activation
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const reply = await server.ext.clusters.callOnOne(
        cluster,
        logger,
        async (client) =>
          await asyncClientCall(client.config, "getAvailablePartitions", {
            accountName,
            userId,
          }),
      );
      return [reply];
    },

    getClusterConfigFiles: async ({ em, logger }) => {

      let clusterConfigs: ReturnType<typeof getClusterConfigs>;
      try {
        clusterConfigs = getClusterConfigs(undefined, logger);
      } catch (e) {
        if (e instanceof ClusterEntryPathsConfigError) {
          throw new ServiceError({
            code: status.INVALID_ARGUMENT,
            details: e.message,
            metadata: scowErrorMetadata(CLUSTER_CONFIG_VALIDATION_ERROR),
          });
        }
        if (e instanceof StorageConfigValidationError) {
          throw new ServiceError({
            code: status.INVALID_ARGUMENT,
            details: e.message,
            metadata: scowErrorMetadata(STORAGE_CONFIG_VALIDATION_ERROR),
          });
        }
        throw e;
      }

      const clusterConfigsProto = convertClusterConfigsToServerProtoType(clusterConfigs);

      const currentConfigClusterIds = Object.keys(clusterConfigs);
      if (currentConfigClusterIds.length === 0) {
        throw new ServiceError({
          code: status.INTERNAL,
          details: "Unable to find cluster configuration files. Please contact the system administrator.",
          metadata: scowErrorMetadata(NO_CLUSTERS),
        });
      }
      // update the activation status of cluster in db
      await updateCluster(em, currentConfigClusterIds, logger);

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

      const reply = await server.ext.clusters.callOnOne(cluster, logger, async (client) => {
        return await asyncClientCall(client.config, "getClusterNodesInfo", {
          nodeNames: nodeNames || [],
        });
      });
      return [{ nodes: reply.nodes }];
    },
  });
});
