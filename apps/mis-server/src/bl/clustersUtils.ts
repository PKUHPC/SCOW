import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { NO_ACTIVATED_CLUSTERS } from "@scow/lib-server/build/misCommon/clustersActivation";
import {
  ClusterActivationStatus,
  clusterActivationStatusFromJSON,
  ClusterRuntimeInfo,
  ClusterRuntimeInfo_LastActivationOperation,
} from "@scow/protos/build/server/config";
import { configClusters } from "src/config/clusters";
import { Cluster } from "src/entities/Cluster";

export async function updateCluster(
  em: SqlEntityManager<MySqlDriver>,
  configClusterIds: string[],
  logger: Logger,
): Promise<void> {
  await em.transactional(async (txnEm) => {
    logger.info("Update cluster entity started.");

    const clustersFromDb = await txnEm.find(Cluster, {});

    const existingClusterIds = clustersFromDb.map((item) => item.clusterId);

    // Delete non-existent cluster IDs from the database
    const shouldDeleteClusters = clustersFromDb.filter((cluster) => !configClusterIds.includes(cluster.clusterId));
    if (shouldDeleteClusters.length > 0) {
      logger.info("Start Delete clusters.");
      txnEm.remove(shouldDeleteClusters);
      logger.info(
        "Cluster IDs: %s not existed in the config files have been marked for deletion.",
        shouldDeleteClusters.map((x) => x.clusterId),
      );
    }

    // Write new records for new cluster IDs
    const shouldCreateClusterIds = configClusterIds.filter((id) => !existingClusterIds.includes(id));
    if (shouldCreateClusterIds.length > 0) {
      logger.info("Start Create clusters.");
      await Promise.all(
        shouldCreateClusterIds.map(async (id) => {
          logger.info("To insert clusterId: %s", id);
          const newCluster = new Cluster({
            clusterId: id,
          });
          txnEm.persist(newCluster);
        }),
      );

      logger.info("Cluster IDs: %s from config files have been created in Cluster.", shouldCreateClusterIds);
    }
    await txnEm.flush();
  });
}

export async function getClustersRuntimeInfo(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
): Promise<ClusterRuntimeInfo[]> {
  const clustersFromDb = await em.find(Cluster, {});

  const reply = clustersFromDb.map((x) => {
    return {
      clusterId: x.clusterId,
      activationStatus: clusterActivationStatusFromJSON(x.activationStatus),
      lastActivationOperation: x.lastActivationOperation as ClusterRuntimeInfo_LastActivationOperation,
      updateTime: x.updateTime ? new Date(x.updateTime).toISOString() : "",
    };
  });

  const clusterDatabaseList = clustersFromDb
    .map((x) => {
      return `Cluster ID: ${x.clusterId}, Current Status: ${x.activationStatus}`;
    })
    .join("; ");

  logger.info("Current clusters list: %s", clusterDatabaseList);

  return reply;
}

export const getActivatedClusters = async (
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
): Promise<Record<string, ClusterConfigSchema>> => {
  const clustersDbInfo = await getClustersRuntimeInfo(em, logger);

  const currentActivatedClusterIds = clustersDbInfo
    .filter((cluster) => {
      return cluster.activationStatus === ClusterActivationStatus.ACTIVATED;
    })
    .map((cluster) => cluster.clusterId);

  if (currentActivatedClusterIds.length === 0) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: "No available clusters. Please try again later",
      metadata: scowErrorMetadata(NO_ACTIVATED_CLUSTERS, { currentActivatedClusters: "" }),
    });
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
