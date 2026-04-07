import { FileOps } from "src/clusterops/api/file";
import { configClusters } from "src/config/clusters";
import { clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";
import { getClusterLoginNode } from "src/utils/ssh";

import { scowdFileServices } from "./scowdFile";
import { sshFileServices } from "./sshFile";


export const fileOps = (cluster: string): FileOps => {

  const clusterInfo = configClusters[cluster];
  if (clusterInfo.scowd?.enabled) {
    const getClient = (userId: string) => getScowdClient(cluster, userId);

    return {
      ...scowdFileServices(getClient),
    };
  } else {
    const host = getClusterLoginNode(cluster);

    if (!host) { throw clusterNotFound(cluster); }

    return {
      ...sshFileServices(host),
    };
  }
};
