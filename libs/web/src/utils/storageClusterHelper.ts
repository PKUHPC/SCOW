import { ClusterConfigSchema, StorageEntrySchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import { PublicStorageConfigSchema } from "@scow/config/build/storage";
import { expandTemplatePath } from "@scow/utils";
import { normPath } from "@scow/utils";

/**
 * 快捷入口路径,解析占位符 {{mountPath}}、{{userId}}
 */
export interface PathEntry {
  displayName: I18nStringType;
  // 解析占位符后的路径
  resolvedPath: string;
}

/**
 * 集群下存储配置
 */
export interface ClusterStorageConfig {
  storageId: string;
  displayName: I18nStringType;
  mountPath: string;
  quotaEnabled: boolean;
  replicaExist: boolean;
}

export function getClusterStorageConfigs(
  clusterEntryPaths: StorageEntrySchema[],
  publicStorageConfig: PublicStorageConfigSchema,
): ClusterStorageConfig[] {
  const storageMap = new Map(publicStorageConfig.storages.map((s) => [s.storageId, s]));

  return (clusterEntryPaths ?? []).map((entry) => {
    const storageItem = storageMap.get(entry.storageId);
    return {
      storageId: entry.storageId,
      displayName: storageItem?.displayName ?? entry.storageId,
      mountPath: entry.mountPath,
      quotaEnabled: storageItem?.quotaEnabled ?? false,
      replicaExist: storageItem?.replicaExist ?? false,
    };
  });
}

/**
 * 检查指定集群是否有任何开启配额的存储
 * 用于门户文件管理页面在选中集群后判断是否展示存储配额功能
 */
export function hasClusterQuotaEnabledStorage(
  clusterEntryPaths?: StorageEntrySchema[],
  publicStorageConfig?: PublicStorageConfigSchema,
): boolean {
  if (!publicStorageConfig || !clusterEntryPaths) return false;
  const clusterStorageConfigs = getClusterStorageConfigs(clusterEntryPaths, publicStorageConfig);
  return clusterStorageConfigs.filter((config) => config.quotaEnabled).length > 0;
}

/**
 * 检查已激活在线集群中，是否任意集群配置的存储系统开启了配额管理
 * 用于判断系统是否开启配额管理功能
 */
export function isStorageQuotaEnabledInActiveClusters(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  activatedClusterIds: string[],
  publicStorageConfig?: PublicStorageConfigSchema,
) {
  return activatedClusterIds.some((clusterId) =>
    hasClusterQuotaEnabledStorage(clusterConfigs[clusterId]?.entryPaths, publicStorageConfig),
  );
}

export function resolveTemplateMountPath(pathTemplate: string, mountPath: string, userId: string): string {
  const raw = expandTemplatePath(pathTemplate, mountPath, userId);
  // 折叠连续斜线（如 pathTemplate 以 "/" 开头而 mountPath 本身也以 "/" 开头时产生的 "//"）
  return normPath(raw);
}

/**
 * 获取集群下路径列表,解析占位符
 */
export function getClusterResolvedEntryPaths(
  clusterConfig: ClusterConfigSchema,
  userId: string | undefined,
): PathEntry[] {
  if (!clusterConfig.entryPaths || !userId) return [];
  return clusterConfig.entryPaths.flatMap((entry) =>
    (entry.paths ?? []).map((path) => ({
      displayName: path.displayName,
      resolvedPath: resolveTemplateMountPath(path.pathTemplate, entry.mountPath, userId),
    })),
  );
}

/**
 * 包含 storageId 和 pathTemplate 的完整快捷路径条目。
 * 用于侧边栏展示、存储配额匹配和用户私有目录自动创建。
 */
export interface EnrichedEntryPath {
  displayName: I18nStringType;
  resolvedPath: string;
  storageId: string;
  pathTemplate: string;
}

/**
 * 构建集群下快捷路径的完整条目列表（含 storageId、pathTemplate）。
 * 替代各组件中重复的 useMemo 逻辑。
 */
export function buildEnrichedEntryPaths(
  entryPaths: StorageEntrySchema[] | undefined,
  userId: string | undefined,
): EnrichedEntryPath[] {
  if (!entryPaths || !userId) return [];
  return entryPaths.flatMap((entry) =>
    (entry.paths ?? []).map((p) => ({
      displayName: p.displayName,
      resolvedPath: resolveTemplateMountPath(p.pathTemplate, entry.mountPath, userId),
      storageId: entry.storageId,
      pathTemplate: p.pathTemplate,
    })),
  );
}
