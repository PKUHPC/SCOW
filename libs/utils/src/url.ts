import { join, normalize } from "path";

/**
 * Join paths to base url or pathname
 * @param base base url. can be a URL or a pathname
 * @param paths other paths
 * @returns joined url
 */
export function joinWithUrl(base: string, ...paths: string[]) {
  // strip protocol

  const protocolIndex = base.indexOf("://");

  const protocol = protocolIndex === -1 ? "" : base.slice(0, protocolIndex + "://".length);
  const noProtocol = base.slice(protocol.length);

  // strip querystring
  const qsIndex = noProtocol.indexOf("?");

  const pathname = noProtocol.slice(0, qsIndex === -1 ? undefined : qsIndex);
  const query = qsIndex === -1 ? "" : noProtocol.slice(qsIndex);

  // join pathanmes
  const joinedPathname = normalize(join(pathname, ...paths));

  return protocol + joinedPathname + query;
}

/**
 * Normalize pathname with query
 * @param pathnameWithQuery pathname possibly with query
 * @returns normalized pathname
 */
export function normalizePathnameWithQuery(pathnameWithQuery: string) {
  // strip querystring
  const qsIndex = pathnameWithQuery.indexOf("?");

  const pathname = pathnameWithQuery.slice(0, qsIndex === -1 ? undefined : qsIndex);
  const qs = qsIndex === -1 ? "" : pathnameWithQuery.slice(qsIndex);

  return normalize(pathname) + qs;
}

/**
 * Remove port from address
 * @param address IP address or hostname possibly with port
 * @returns address without port
 */
export function removePort(address: string): string {
  // Remove :port if present
  return address.replace(/:\d+$/, "");
}

/**
 * 解析路径模板，替换其中的 {{mountPath}} 和 {{userId}} 占位符。
 */
export function expandTemplatePath(pathTemplate: string, mountPath: string, userId: string): string {
  return pathTemplate.replace(/\{\{mountPath\}\}/g, mountPath).replace(/\{\{userId\}\}/g, userId);
}

/**
 * 确保路径以 `/` 开头，并折叠连续斜杠。
 * 用于侧边栏路径匹配等需要规范化路径的场景。
 */
export function normPath(p: string): string {
  const withSlash = p.startsWith("/") ? p : "/" + p;
  return withSlash.replace(/\/+/g, "/");
}
