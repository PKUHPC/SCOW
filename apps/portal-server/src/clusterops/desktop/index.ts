import { DesktopOps } from "src/clusterops/api/desktop";
import { configClusters } from "src/config/clusters";
import { clusterNotFound } from "src/utils/errors";

import { scowdDesktopServices } from "./scowdDesktop";

export const desktopOps = (cluster: string): DesktopOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  return { ...scowdDesktopServices(cluster) };
};
