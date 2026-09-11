/**
 * 确保路径非空且以 `/` 开头。
 * 用于 PathBar 显示和 Modal 中的路径处理。
 */
export function formatPath(path: string): string {
  if (!path || path === "") {
    return "/";
  }
  if (!path.startsWith("/")) {
    return "/" + path;
  }
  return path;
}
