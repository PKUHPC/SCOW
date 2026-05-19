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
