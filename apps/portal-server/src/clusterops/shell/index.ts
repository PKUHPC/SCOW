import { ShellOps } from "src/clusterops/api/shell";
import { configClusters } from "src/config/clusters";
import { clusterNotFound } from "src/utils/errors";

import { scowdShellServices } from "./scowdShell";

export const shellOps = (cluster: string): ShellOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  return { ...scowdShellServices() };
};
