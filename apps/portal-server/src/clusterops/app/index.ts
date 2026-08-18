import { AppOps } from "src/clusterops/api/app";
import { configClusters } from "src/config/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";

import { scowdAppServices } from "./scowdApp";

export const appOps = (cluster: string): AppOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const getClient = (userId: string) => getScowdClient(cluster, userId);

  return { ...scowdAppServices(cluster, getClient) };
};
