import { FastifyRequest } from "fastify";

export function getHostname(req: FastifyRequest | undefined) {
  const host = getHost(req);
  return host?.includes(":") ? host?.split(":")[0] : host;
}

export function getHost(req: FastifyRequest | undefined) {
  return req?.headers?.host;
}
