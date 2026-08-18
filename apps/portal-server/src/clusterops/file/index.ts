import { FileOps } from "src/clusterops/api/file";
import { configClusters } from "src/config/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";

import { scowdFileServices } from "./scowdFile";

export const fileOps = (cluster: string): FileOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const getClient = (userId: string) => getScowdClient(cluster, userId);

  return { ...scowdFileServices(getClient) };
};
