import { I18nStringType } from "@scow/config/build/i18n";

export interface Cluster {
  id: string;
  name: I18nStringType;
}

/**
 * 判断 childFolderPath 是否是 potentialParentFolderPath 的子路径或本身。
 * 前端版本：不依赖 node path 模块，固定使用 / 分隔符
 */
export function isParentOrSameFolderForWeb(potentialParentFolderPath: string, childFolderPath: string): boolean {
  // 简单normalize：合并多余的 /，去掉末尾的 /
  const normalize = (p: string) => p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";

  const normalizedParent = normalize(potentialParentFolderPath);
  const normalizedChild = normalize(childFolderPath);

  return normalizedChild === normalizedParent || normalizedChild.startsWith(normalizedParent + "/");
}
