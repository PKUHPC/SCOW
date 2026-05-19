import { DesktopOps } from "src/clusterops/api/desktop";
import { configClusters } from "src/config/clusters";

import { scowdDesktopServices } from "./scowdDesktop";
import { sshDesktopServices } from "./sshDesktop";

export const desktopOps = (cluster: string): DesktopOps => {
  const clusterInfo = configClusters[cluster];
  if (clusterInfo.scowd?.enabled) {
    return {
      ...scowdDesktopServices(cluster),
    };
  } else {
    return {
      ...sshDesktopServices(cluster),
    };
  }
};
