import { ClusterConfigSchema, SimpleClusterSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import { PublicStorageItem } from "@scow/config/build/storage";
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
 * 只要存在一个已激活集群挂载了 quotaEnabled 的文件系统，就认为存储管理功能可用。
 * 新多存储方案下不再依赖旧 storage.enabled 配置。
 * @returns {boolean} storageEnabled
 */
export function getStorageEnabled(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  activatedClusterIds: string[],
  publicStorageConfigs: Record<string, PublicStorageItem>,
) {
  const activatedClusterIdSet = new Set(activatedClusterIds);

  return Object.entries(clusterConfigs).some(([clusterId, config]) => {
    if (!activatedClusterIdSet.has(clusterId)) {
      return false;
    }

    return (config.entryPaths ?? []).some(
      (entryPath) => publicStorageConfigs[entryPath.storageId]?.quotaEnabled,
    );
  });
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
