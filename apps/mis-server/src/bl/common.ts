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

import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterDatabaseInfo, clusterOnlineStatusFromJSON } from "@scow/protos/build/server/config";
import { Cluster } from "src/entities/Cluster";

export async function updateCluster(
  em: SqlEntityManager<MySqlDriver>,
  configClusterIds: string[],
  logger: Logger,
): Promise<void> {

  logger.info("Update cluster entity started.");

  const clustersFromDb = await em.findAll(Cluster, {});

  const existingClusterIds = clustersFromDb.map((item) => item.clusterId);

  // Delete non-exist cluster IDs from the database
  const shouldDeleteClusters = clustersFromDb.filter((cluster) => !configClusterIds.includes(cluster.clusterId));
  if (shouldDeleteClusters.length > 0) {
    logger.info("Start Delete clusters.");
    em.removeAndFlush([shouldDeleteClusters]);
    logger.info("Cluster IDs: %s not existed in the config files have been deleted from Cluster.",
      shouldDeleteClusters.map((x) => x.clusterId));
  }

  // Write new records for new cluster IDs
  const shouldCreateClusterIds = configClusterIds.filter((id) => !existingClusterIds.includes(id));
  if (shouldCreateClusterIds.length > 0) {
    logger.info("Start Create clusters.");
    shouldCreateClusterIds.forEach(async (id) => {
      logger.info("To insert clusterId: %s", id);
      const newCluster = new Cluster({
        clusterId: id,
      });
      em.persistAndFlush(newCluster);
    });

    logger.info("Cluster IDs: %s from config files have been created in Cluster .", shouldCreateClusterIds);
  }

}

export async function getClustersDatabaseInfo(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
): Promise<ClusterDatabaseInfo[]> {

  logger.info("Get current clusters online and offline info started.");

  const clustersFromDb = await em.findAll(Cluster, {});

  const reply = clustersFromDb.map((x) => {
    return {
      clusterId: x.clusterId,
      onlineStatus: clusterOnlineStatusFromJSON(x.onlineStatus),
      operatorId: x.operatorId,
      comment: x.comment,
    };
  });

  const clusterOnlineStatusList = clustersFromDb.map((x) => {
    return `(Cluster ID: ${x.clusterId}) : ${x.onlineStatus}`;
  }).join("; ");

  logger.info("Current clusters list: %s", clusterOnlineStatusList);

  return reply;
}
