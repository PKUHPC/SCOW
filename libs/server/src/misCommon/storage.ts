import { ClusterConfigSchema } from "@scow/config/build/cluster";
import {
  GpfsConfigSchema,
  LustreConfigSchema,
  NfsConfigSchema,
  OceanStorPacificConfigSchema,
  StorageFsSchema,
  StorageFsType,
  StorageItemSchema,
  findStorageById,
  getServerStorageConfig,
} from "@scow/config/build/storage";

export interface ServerStorageConfig {
  storageId: string;
  mountPath: string;
  fs: StorageFsSchema;
}

export interface StorageMountRef extends ServerStorageConfig {
  clusterId: string;
  storage: StorageItemSchema;
}

/**
 * 获取各集群下的已配置存储管理的存储系统的详细信息
 * 包含fs信息，仅用于后端使用
 *
 * @param clusterConfig  集群配置
 * @returns
 */
export function getClusterQuotaStorageConfigs(
  clusterConfig: ClusterConfigSchema,
): ServerStorageConfig[] {
  const storageConfigs = getServerStorageConfig();
  // 构建集群下的 storageId -> mountPath 映射
  const mountPathMap = new Map(
    (clusterConfig.entryPaths ?? []).map((entry) => [entry.storageId, entry.mountPath]),
  );

  return storageConfigs.storages
    .filter((s) => s.quotaEnabled && mountPathMap.has(s.storageId))
    .map((s) => ({
      storageId: s.storageId,
      mountPath: mountPathMap.get(s.storageId)!,
      fs: s.fs,
    }));
}

interface StorageConfigProto {
  storageId: string;
  fsConfig:
    | { case: "oceanStorPacific"; value: OceanStorPacificConfigSchema }
    | { case: "nfs"; value: NfsConfigSchema }
    | { case: "lfs"; value: LustreConfigSchema }
    | { case: "gpfs"; value: GpfsConfigSchema }
    | { case: undefined; value?: undefined };
}

export function getStorageMountRefs(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  storageId: string,
): StorageMountRef[] {
  const storageConfigs = getServerStorageConfig();
  const storage = findStorageById(storageConfigs, storageId);

  if (!storage) {
    // storageId 不存在属于明确的配置错误，交由上层统一按错误路径处理，
    // 避免静默返回空数组把配置缺失误当成“无挂载结果”。
    const maxPreviewCount = 5;
    const availableStorageIds = storageConfigs.storages
      .slice(0, maxPreviewCount)
      .map((item) => item.storageId)
      .join(", ");
    const truncatedSuffix = storageConfigs.storages.length > maxPreviewCount ? ", ..." : "";
    throw new Error(
      `Storage ${storageId} is not defined in storage config. Available storages: ${availableStorageIds}${truncatedSuffix}`,
    );
  }

  return Object.entries(clusterConfigs).flatMap(([clusterId, clusterConfig]) => {
    return (clusterConfig.entryPaths ?? [])
      .filter((entry) => entry.storageId === storageId)
      .map((entry) => ({
        clusterId,
        storageId,
        mountPath: entry.mountPath,
        fs: storage.fs,
        storage,
      }));
  });
}

export function getExecutableStorageIds(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  activatedClusterIds: Set<string>,
): string[] {
  return Array.from(
    new Set(
      Object.values(clusterConfigs).flatMap((clusterConfig) =>
        (clusterConfig.entryPaths ?? []).map((entry) => entry.storageId),
      ),
    ),
  ).filter((storageId) =>
    getStorageMountRefs(clusterConfigs, storageId).some(
      (ref) =>
        ref.storage.quotaEnabled &&
        activatedClusterIds.has(ref.clusterId),
    ),
  );
}

export function buildStorageConfigProto(storage: ServerStorageConfig): StorageConfigProto {
  const { storageId, fs } = storage;
  const fsType = fs.type as StorageFsType;

  switch (fsType) {
    case StorageFsType.oceanStorPacific:
      return {
        storageId,
        fsConfig: {
          case: "oceanStorPacific",
          value: {
            ...(fs.oceanStorPacific as OceanStorPacificConfigSchema),
          },
        },
      };
    case StorageFsType.nfs:
      return {
        storageId,
        fsConfig: {
          case: "nfs",
          value: { ...(fs.nfs as NfsConfigSchema) },
        },
      };
    case StorageFsType.lfs:
      return {
        storageId,
        fsConfig: {
          case: "lfs",
          value: { ...(fs.lfs as LustreConfigSchema) },
        },
      };
    case StorageFsType.gpfs:
      return {
        storageId,
        fsConfig: {
          case: "gpfs",
          value: { ...(fs.gpfs as GpfsConfigSchema) },
        },
      };
    default:
      throw new Error(`不支持的文件系统类型: ${fs.type}`);
  }
}
