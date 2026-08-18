import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { ClusterActivationStatus, ConfigServiceClient } from "@scow/protos/build/server/config";

import { getClientFn } from "../api";
import { scowErrorMetadata } from "../error";

/**
 * get current activated clusters
 *
 * @param logger
 * @param configClusters clusters from all config files
 * @param misServerUrl mis-server url
 * @param scowApiAuthToken
 * @returns
 */
export const libGetCurrentActivatedClusters = async (
  logger: Logger,
  configClusters: Record<string, ClusterConfigSchema>,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<Record<string, ClusterConfigSchema>> => {
  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(ConfigServiceClient);

  const reply = await asyncClientCall(client, "getClustersRuntimeInfo", {});
  const clustersDatabaseInfo = reply.results;

  const filteredList = clustersDatabaseInfo.filter(
    (cluster) => cluster.activationStatus === ClusterActivationStatus.ACTIVATED,
  );
  const currentActivatedClusterIds = filteredList.map((cluster) => cluster.clusterId);

  if (currentActivatedClusterIds.length === 0) {
    logger.info("No available activated clusters. %o", clustersDatabaseInfo);
    return {};
  }
  return currentActivatedClusterIds.reduce(
    (acc, clusterId) => {
      if (configClusters[clusterId]) {
        acc[clusterId] = configClusters[clusterId];
      }
      return acc;
    },
    {} as Record<string, ClusterConfigSchema>,
  );
};

export const NO_ACTIVATED_CLUSTERS = "NO_ACTIVATED_CLUSTERS";
export const NOT_EXIST_IN_ACTIVATED_CLUSTERS = "NOT_EXIST_IN_ACTIVATED_CLUSTERS";
export const NO_CLUSTERS = "NO_CLUSTERS";

/**
 * check current querying clusters is in activated clusters or not
 *
 * @param clusterIds string | string[]
 *  when string[] => used in checking fromCluster and toCluster in fileTransfer feature at the same time
 * @param activatedClusters currently activated clusters
 * @param logger
 */
export const libCheckActivatedClusters = ({
  clusterIds,
  activatedClusters,
  logger,
}: {
  clusterIds: string[] | string;
  activatedClusters: Record<string, ClusterConfigSchema>;
  logger: Logger;
}) => {
  const idsToCheck = Array.isArray(clusterIds) ? clusterIds : [clusterIds];

  logger.info("Checking activation status of clusters with ids (%o) ", idsToCheck);
  if (Object.keys(activatedClusters).length === 0) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: "No available clusters. Please try again later",
      metadata: scowErrorMetadata(NO_ACTIVATED_CLUSTERS, { currentActivatedClusters: "" }),
    });
  }

  const exist = idsToCheck.every((id) => Object.keys(activatedClusters).find((x) => x === id));
  if (!exist) {
    logger.info(
      "Querying deactivated clusters with ids (%o). The current activated clusters' ids: %o",
      clusterIds,
      Object.keys(activatedClusters),
    );
    throw new ServiceError({
      code: status.INTERNAL,
      details: "Querying deactivated clusters. Please refresh the page and try again",
      metadata: scowErrorMetadata(NOT_EXIST_IN_ACTIVATED_CLUSTERS, {
        currentActivatedClusterIds:
          Object.keys(activatedClusters).length > 0 ? JSON.stringify(Object.keys(activatedClusters)) : "",
      }),
    });
  }
};
