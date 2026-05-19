import { IncomingMessage } from "http";

export function getHostname(req: IncomingMessage | undefined) {
  const host = getHost(req);
  return host?.includes(":") ? host?.split(":")[0] : host;
}

export function getHost(req: IncomingMessage | undefined) {
  return req?.headers?.host;
}
