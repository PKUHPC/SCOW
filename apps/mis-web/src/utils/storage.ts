import { getClusterConfigs } from "@scow/config/build/cluster";

/**
 * 根据 storageId 反查其当前被哪些集群挂载。
 */
export const getMountedClusterIdsByStorageId = (storageId: string) => {
  const clusterConfigs = getClusterConfigs(undefined, console);

  return Array.from(
    new Set(
      Object.entries(clusterConfigs)
        .filter(([, clusterConfig]) => (clusterConfig.entryPaths ?? []).some((entry) => entry.storageId === storageId))
        .map(([clusterId]) => clusterId),
    ),
  );
};

/**
 * 只做"租户已授权集群"和"storage 挂载集群"的交集校验。
 * 如果当前配置里找不到任何挂载集群，则直接判无权限，避免把未挂载的 storage
 * 误当成可访问对象。
 */
export const hasStorageAccess = (storageId: string, assignedClusterIds: string[]) => {
  const mountedClusterIds = getMountedClusterIdsByStorageId(storageId);

  if (mountedClusterIds.length === 0) {
    return false;
  }

  return mountedClusterIds.some((clusterId) => assignedClusterIds.includes(clusterId));
};
