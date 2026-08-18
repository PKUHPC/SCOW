import { Cluster, ClusterActivationStatus, ClusterRuntimeInfo } from "@scow/config/build/type";

/**
 * format clusters used in web into activated clusters only
 * @param clustersRuntimeInfo clusters activation data from db
 * @param  misConfigClusters config clusters type used in mis => {[clusterId: string]: Cluster},
 * @param configClusters config clusters type used in portal or other system => Cluster[]
 *
 * @returns misActivatedClusters
 * @returns activatedClusters
 */
export function formatActivatedClusters({
  clustersRuntimeInfo,
  misConfigClusters,
  configClusters,
}: {
  clustersRuntimeInfo?: ClusterRuntimeInfo[];
  misConfigClusters?: Record<string, Cluster>;
  configClusters?: Cluster[];
}): {
  misActivatedClusters?: Record<string, Cluster>;
  activatedClusters?: Cluster[];
} {
  if (!clustersRuntimeInfo || clustersRuntimeInfo.length === 0) {
    console.info("No available activated clusters in database.");
    return misConfigClusters ? { misActivatedClusters: {} } : { activatedClusters: [] };
  }

  if (configClusters) {
    const activatedClusters = configClusters.filter((cluster) =>
      clustersRuntimeInfo.find(
        (x) => x.activationStatus === ClusterActivationStatus.ACTIVATED && x.clusterId === cluster.id,
      ),
    );
    return { activatedClusters: activatedClusters ?? [] };
  } else {
    const misActivatedClusters: Record<string, Cluster> = {};

    if (!misConfigClusters) {
      console.warn("No available clusters in Mis");
      return { misActivatedClusters: {} };
    } else {
      clustersRuntimeInfo.forEach((x) => {
        if (x.activationStatus === ClusterActivationStatus.ACTIVATED) {
          misActivatedClusters[x.clusterId] = misConfigClusters[x.clusterId];
        }
      });

      return { misActivatedClusters };
    }
  }
}
