"use client";

import { normPath } from "@scow/utils";
import { useEffect, useState } from "react";

/**
 * 根据当前路径自动选中侧边栏条目（最长前缀匹配）。
 *
 * @param path           当前浏览路径
 * @param homePath       家目录路径（undefined 表示尚未加载）
 * @param entryPaths     快捷路径条目列表。
 *                       **调用方必须保证此数组引用稳定**（例如用 `useMemo` 包裹），
 *                       否则每次渲染都会触发内部 useEffect，导致不必要的重渲染。
 * @param skipPlaceholder 占位符路径（如 "~"），在此值下跳过匹配
 * @returns              当前应选中的侧边栏索引："home" | number | null
 */
export function useAutoSelectSidebar(
  path: string,
  homePath: string | null | undefined,
  entryPaths: { resolvedPath: string }[],
  skipPlaceholder = "~",
): "home" | number | null {
  const [selectedIndex, setSelectedIndex] = useState<"home" | number | null>(null);

  useEffect(() => {
    if (path === skipPlaceholder) return;

    let best: "home" | number | null = null;
    let bestLen = -1;
    const normalizedPath = normPath(path);

    const check = (candidate: string, key: "home" | number) => {
      const normalizedCandidate = normPath(candidate);
      if (normalizedPath === normalizedCandidate || normalizedPath.startsWith(normalizedCandidate + "/")) {
        if (normalizedCandidate.length > bestLen) {
          bestLen = normalizedCandidate.length;
          best = key;
        }
      }
    };

    if (homePath) check(homePath, "home");
    entryPaths.forEach((entry, index) => check(entry.resolvedPath, index));

    setSelectedIndex(best);
  }, [path, homePath, entryPaths, skipPlaceholder]);

  return selectedIndex;
}
