import { usePublicConfig } from "src/app/(auth)/context";
import { Cluster } from "src/server/trpc/route/config";

const SCOW_DEFAULT_CLUSTER_ID = "SCOW_DEFAULT_CLUSTER_ID";

export function defaultClusterContext(clusters: Cluster[], currentClusterIds: string[]) {
  const currentClusters = clusters.filter((cluster) => currentClusterIds.includes(cluster.id));

  const clusterId = window.localStorage.getItem(SCOW_DEFAULT_CLUSTER_ID);

  const defaultCluster = currentClusters.find((cluster) => cluster.id === clusterId) || currentClusters[0] || undefined;

  const setDefaultCluster = (cluster: Cluster | undefined) => {
    window.localStorage.setItem(SCOW_DEFAULT_CLUSTER_ID, cluster?.id ?? "");
  };

  const removeDefaultCluster = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SCOW_DEFAULT_CLUSTER_ID);
    }
  };

  return { defaultCluster, setDefaultCluster, removeDefaultCluster, currentClusters };
}

export function useDefaultCluster() {
  const {
    publicConfig: { CLUSTERS },
    currentAvailableClusterIds,
  } = usePublicConfig();
  return defaultClusterContext(CLUSTERS, currentAvailableClusterIds ?? []);
}
