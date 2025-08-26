/**
 * 移除路径开头和结尾的斜杠。
 * @param {string} path 需要处理的路径字符串。
 * @returns {string} 处理后的路径字符串。
 */
export const trimPathSlashes = (path: string): string => {
  if (!path) {
    return "";
  }
  let trimmedPath = path;

  // 移除开头的斜杠
  if (trimmedPath.startsWith("/")) {
    trimmedPath = trimmedPath.substring(1);
  }

  // 移除末尾的斜杠
  if (trimmedPath.endsWith("/")) {
    trimmedPath = trimmedPath.substring(0, trimmedPath.length - 1);
  }

  return trimmedPath;
};
