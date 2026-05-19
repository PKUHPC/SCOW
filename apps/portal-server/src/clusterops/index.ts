import { ClusterOps } from "src/clusterops/api";
import { appOps } from "src/clusterops/app/index";
import { desktopOps } from "src/clusterops/desktop/index";
import { fileOps } from "src/clusterops/file/index";
import { jobOps } from "src/clusterops/job/index";
import { shellOps } from "src/clusterops/shell/index";
import { configClusters } from "src/config/clusters";

const clusters = configClusters;

const opsForClusters = Object.entries(clusters).reduce(
  (prev, [cluster]) => {
    prev[cluster] = {
      app: appOps(cluster),
      job: jobOps(cluster),
      desktop: desktopOps(cluster),
      file: fileOps(cluster),
      shell: shellOps(cluster),
    } as ClusterOps;
    return prev;
  },
  {} as Record<string, ClusterOps>,
);

export const getClusterOps = (cluster: string) => {
  return opsForClusters[cluster];
};
