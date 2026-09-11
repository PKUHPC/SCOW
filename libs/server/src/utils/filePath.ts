import { StorageEntrySchema } from "@scow/config/build/cluster";
import { expandTemplatePath, normPath } from "@scow/utils";
import { resolve, sep } from "path";

/**
 * 判断 targetPath 是否完全匹配某条含 {{userId}} 的快捷路径模板。
 * 用于 readDirectory 时检测到目录不存在后，决定是否自动创建用户私有目录。
 *
 * @param entryPaths  集群配置中的 entryPaths 数组
 * @param userId      当前用户 ID
 * @param targetPath  请求的目标路径
 */
export function isUserPrivateEntryPath(
  entryPaths: StorageEntrySchema[] | undefined,
  userId: string,
  targetPath: string,
): boolean {
  if (!entryPaths) return false;
  for (const entry of entryPaths) {
    for (const p of entry.paths ?? []) {
      if (!p.pathTemplate.includes("{{userId}}")) continue;
      const expanded = expandTemplatePath(p.pathTemplate, entry.mountPath, userId);
      // 只格式化多余斜线等规范化问题，不解析 ".." 等路径段，避免绕过父目录检查
      if (normPath(expanded) === normPath(targetPath)) return true;
    }
  }
  return false;
}

/**
 * 判断 childFolderPath 是否是 potentialParentFolderPath 的子路径或本身。
 */
export function isParentOrSameFolder(potentialParentFolderPath: string, childFolderPath: string): boolean {
  const normalizedParentPath = resolve(potentialParentFolderPath);
  const normalizedChildPath = resolve(childFolderPath);

  const parentPathWithTrailingSlash = normalizedParentPath.endsWith(sep)
    ? normalizedParentPath
    : `${normalizedParentPath}${sep}`;

  return normalizedChildPath === normalizedParentPath || normalizedChildPath.startsWith(parentPathWithTrailingSlash);
}
