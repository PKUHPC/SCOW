import { ClusterConfigSchema, SimpleClusterSchema } from "@scow/config/build/cluster";
import { PublicStorageConfigSchema, PublicStorageItem } from "@scow/config/build/storage";
import { getSortedClusterIds } from "@scow/lib-web/build/utils/cluster";
import { isStorageQuotaEnabledInActiveClusters } from "@scow/lib-web/build/utils/storageClusterHelper";
import { useEffect, useState } from "react";
import { Cluster, getPublicConfigClusters } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

export function ClusterInfoStore(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  initialPublicStorageConfigs: PublicStorageConfigSchema,
  initialActivatedClusters: Record<string, Cluster>,
  initialSimpleClusters: Record<string, SimpleClusterSchema>,
) {
  let publicConfigClusters: Record<string, Cluster> = {};
  let clusterSortedIdList: string[] = [];
  const publicStorageConfigs = initialPublicStorageConfigs.storages.reduce<
    Record<string, PublicStorageItem>
  >((storageMap, storage) => {
    storageMap[storage.storageId] = storage;
    return storageMap;
  }, {});

  if (Object.keys(clusterConfigs).length > 0) {
    clusterSortedIdList = getSortedClusterIds(clusterConfigs);
    publicConfigClusters = getPublicConfigClusters(clusterConfigs);
  } else {
    clusterSortedIdList = getSortedClusterIds(initialSimpleClusters ?? {});
    publicConfigClusters = getPublicConfigClusters(initialSimpleClusters ?? {});
  }

  const [activatedClusters, setActivatedClusters] =
    useState<Record<string, Cluster>>(initialActivatedClusters);

  const initialDefaultClusterId = clusterSortedIdList.find((x) => {
    return Object.keys(initialActivatedClusters).find((c) => c === x);
  });

  const initialDefaultCluster = initialDefaultClusterId
    ? activatedClusters[initialDefaultClusterId]
    : undefined;

  const [defaultCluster, setDefaultCluster] = useState<Cluster | undefined>(initialDefaultCluster);
  const [fullClusterConfigs, _] = useState<Record<string, ClusterConfigSchema>>(clusterConfigs);
  const initialStorageEnabled = isStorageQuotaEnabledInActiveClusters(
    clusterConfigs,
    Object.keys(initialActivatedClusters),
    publicConfig.PUBLIC_STORAGE_CONFIG,
  );
  const [storageEnabled, setStorageEnabled] = useState<boolean>(initialStorageEnabled);
  const [accountStorageQuotaConfirmed, setAccountStorageQuotaConfirmed] = useState<boolean>(false);
  const [accountStorageQuotaEnabled, setAccountStorageQuotaEnabled] = useState<boolean>(false);

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
        const currentDefaultExists = Object.keys(activatedClusters).find(
          (x) => x === defaultCluster?.id,
        );
        if (!currentDefaultExists) {
          setDefaultCluster(Object.values(activatedClusters)[0]);
        }
      }
    }

    setStorageEnabled(
      isStorageQuotaEnabledInActiveClusters(
        clusterConfigs,
        Object.keys(activatedClusters),
        publicConfig.PUBLIC_STORAGE_CONFIG,
      ),
    );
  }, [activatedClusters, clusterConfigs, publicStorageConfigs]);

  return {
    fullClusterConfigs,
    publicStorageConfigs,
    publicConfigClusters,
    clusterSortedIdList,
    activatedClusters,
    setActivatedClusters,
    defaultCluster,
    setDefaultCluster,
    storageEnabled,
    accountStorageQuotaConfirmed,
    setAccountStorageQuotaConfirmed,
    accountStorageQuotaEnabled,
    setAccountStorageQuotaEnabled,
  };
}
