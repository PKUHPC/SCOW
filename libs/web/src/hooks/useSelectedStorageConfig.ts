"use client";

import { normPath } from "@scow/utils";
import { useMemo } from "react";
import { ClusterStorageConfig } from "src/utils/storageClusterHelper";

/**
 * 对各存储挂载点做最长前缀匹配，返回当前路径对应的存储配置。
 * 不依赖配额数据，仅基于 mountPath 匹配。
 */
export function useSelectedStorageConfig(
  path: string,
  clusterStorageConfigs: ClusterStorageConfig[],
): ClusterStorageConfig | null {
  return useMemo(() => {
    if (!clusterStorageConfigs.length) return null;

    let bestLen = -1;
    let best: ClusterStorageConfig | undefined;
    const normalizedPath = normPath(path);

    for (const cfg of clusterStorageConfigs) {
      const normalizedMount = normPath(cfg.mountPath);
      if (normalizedPath === normalizedMount || normalizedPath.startsWith(normalizedMount + "/")) {
        if (normalizedMount.length > bestLen) {
          bestLen = normalizedMount.length;
          best = cfg;
        }
      }
    }

    return best ?? null;
  }, [path, clusterStorageConfigs]);
}
