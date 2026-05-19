import { ClusterConfigSchema, SimpleClusterSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";

export interface Cluster {
  id: string;
  name: I18nStringType;
}

export const getClusterName = (
  clusterId: string,
  languageId: string,
  publicConfigClusters: Record<string, Cluster>,
) => {
  return getI18nConfigCurrentText(publicConfigClusters[clusterId]?.name, languageId) || clusterId;
};

export function getClusterNameWithUndefined(
  clusterId: string | undefined,
  languageId: string,
  publicConfigClusters: Record<string, Cluster>,
) {
  return clusterId ? getClusterName(clusterId, languageId, publicConfigClusters) : "-";
}

/**
 * 有一个启用了的集群启用存储管理，则认为开启了存储管理功能
 * @param {Record<String, import("@scow/config/build/cluster").ClusterConfigSchema>} clusters
 * @returns {boolean} storageEnabled
 */
export function getStorageEnabled(clusterConfigs: Record<string, ClusterConfigSchema>, activatedClusterIds: string[]) {
  return (
    Object.entries(clusterConfigs).filter(
      ([cluster, config]) => config.storage?.enabled && activatedClusterIds.includes(cluster),
    ).length > 0
  );
}

export const getSortedClusterValues = (
  publicConfigClusters: Record<string, Cluster>,
  clusterSortedIdList: string[],
): Cluster[] => {
  const sortedClusters: Cluster[] = [];
  clusterSortedIdList.forEach((clusterId) => {
    sortedClusters.push(publicConfigClusters[clusterId]);
  });

  return sortedClusters;
};

export const getPublicConfigClusters = (
  configClusters: Record<string, Partial<SimpleClusterSchema>>,
): Record<string, Cluster> => {
  const publicConfigClusters: Record<string, Cluster> = {};

  Object.keys(configClusters).forEach((clusterId) => {
    const cluster = {
      id: clusterId,
      name: configClusters[clusterId].displayName!,
    };
    publicConfigClusters[clusterId] = cluster;
  });

  return publicConfigClusters;
};
