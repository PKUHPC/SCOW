import { ClusterConfigSchema, SimpleClusterSchema } from "@scow/config/build/cluster";
import { getSortedClusterIds } from "@scow/lib-web/build/utils/cluster";
import { useEffect, useState } from "react";
import { Cluster, getPublicConfigClusters, getStorageEnabled } from "src/utils/cluster";

export function ClusterInfoStore(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  initialActivatedClusters: Record<string, Cluster>,
  initialSimpleClusters: Record<string, SimpleClusterSchema>,
) {
  let publicConfigClusters: Record<string, Cluster> = {};
  let clusterSortedIdList: string[] = [];

  if (Object.keys(clusterConfigs).length > 0) {
    clusterSortedIdList = getSortedClusterIds(clusterConfigs);
    publicConfigClusters = getPublicConfigClusters(clusterConfigs);
  } else {
    clusterSortedIdList = getSortedClusterIds(initialSimpleClusters ?? {});
    publicConfigClusters = getPublicConfigClusters(initialSimpleClusters ?? {});
  }

  const [activatedClusters, setActivatedClusters] = useState<Record<string, Cluster>>(initialActivatedClusters);

  const initialDefaultClusterId = clusterSortedIdList.find((x) => {
    return Object.keys(initialActivatedClusters).find((c) => c === x);
  });

  const initialDefaultCluster = initialDefaultClusterId ? activatedClusters[initialDefaultClusterId] : undefined;

  const [defaultCluster, setDefaultCluster] = useState<Cluster | undefined>(initialDefaultCluster);
  const [fullClusterConfigs, _] = useState<Record<string, ClusterConfigSchema>>(clusterConfigs);
  const [storageEnabled, setStorageEnabled] = useState<boolean>(false);

  useEffect(() => {
    // 可用集群不存在时
    if (Object.keys(activatedClusters).length === 0) {
      setDefaultCluster(undefined);
    } else {
      // 上一次记录的默认集群为undefined的情况，使用可用集群中的某一个集群作为新的默认集群
      if (!defaultCluster?.id) {
        setDefaultCluster(Object.values(activatedClusters)[0]);

        // 上一次记录的默认集群已不在可用集群中的情况
      } else {
        const currentDefaultExists = Object.keys(activatedClusters).find((x) => x === defaultCluster?.id);
        if (!currentDefaultExists) {
          setDefaultCluster(Object.values(activatedClusters)[0]);
        }
      }
    }

    setStorageEnabled(getStorageEnabled(clusterConfigs, Object.keys(activatedClusters)));
  }, [activatedClusters]);

  return {
    fullClusterConfigs,
    publicConfigClusters,
    clusterSortedIdList,
    activatedClusters,
    setActivatedClusters,
    defaultCluster,
    setDefaultCluster,
    storageEnabled,
  };
}
