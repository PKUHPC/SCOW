import { AppOps } from "src/clusterops/api/app";
import { configClusters } from "src/config/clusters";
import { getScowdClient } from "src/utils/scowd";
import { getClusterLoginNode } from "src/utils/ssh";

import { scowdAppServices } from "./scowdApp";
import { sshAppServices } from "./sshApp";


export const appOps = (cluster: string): AppOps => {

  const clusterInfo = configClusters[cluster];
  if (clusterInfo.scowd?.enabled) {
    const getClient = (userId: string) => getScowdClient(cluster, userId);

    return {
      ...scowdAppServices(cluster, getClient),
    };
  } else {
    const host = getClusterLoginNode(cluster);

    if (!host) { throw new Error(`Cluster ${cluster} has no login node`); }

    return {
      ...sshAppServices(cluster, host),
    };
  }
};
