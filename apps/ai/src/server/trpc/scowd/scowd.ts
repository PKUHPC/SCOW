import { Code, ConnectError } from "@connectrpc/connect";
import { getLoginNode } from "@scow/config/build/cluster";
import { createBalancedScowdClientGetter, SafeConnectTransportOptions } from "@scow/lib-scowd/build/client";
import { createScowdCertificates } from "@scow/lib-scowd/build/ssl";
import { removePort } from "@scow/utils";
import { TRPCError } from "@trpc/server";
import { clusters } from "src/server/config/clusters";
import { config } from "src/server/config/env";
import { scowdClientNotFound } from "src/server/utils/errors";
import { logger } from "src/server/utils/logger";
import { Logger } from "ts-log";

export const certificates = createScowdCertificates(config);

export function generateScowdUrl(address: string, scowdPort: number) {
  return config.SCOWD_SSL_ENABLED
    ? `https://${removePort(address)}:${scowdPort}`
    : `http://${removePort(address)}:${scowdPort}`;
}

export function getLoginNodeScowdUrl(cluster: string, host: string): string | undefined {
  const loginNode = getLoginNodeFromAddress(cluster, host);

  if (!loginNode) return undefined;

  const { address, scowdPort } = loginNode;

  return generateScowdUrl(address, scowdPort);
}

// Cache for ScowdClient instances
const getClientByCluster = createBalancedScowdClientGetter({
  getClusterIds: () => Object.keys(clusters),
  getClusterInfo: (cluster) => clusters[cluster],
  getLoginNodes: (clusterInfo) => clusterInfo?.loginNodes,
  getLoginNode,
  getLoginNodeAddress: (loginNode) => loginNode.address,
  getLoginNodeScowdUrl,
  certificates,
  logger,
});

export const getScowdClient = (
  cluster: string,
  userIdOrOptions?: string | SafeConnectTransportOptions,
  connectTransportOptions?: SafeConnectTransportOptions,
) => {
  const userId = typeof userIdOrOptions === "string" ? userIdOrOptions : undefined;
  const options = typeof userIdOrOptions === "string" ? connectTransportOptions : userIdOrOptions;
  const client = getClientByCluster(cluster, userId, options);
  if (!client) {
    throw scowdClientNotFound(cluster);
  }
  return client;
};

export function getLoginNodeFromAddress(cluster: string, address: string) {
  const clusterInfo = clusters[cluster];
  const loginNodes = clusterInfo?.loginNodes.map(getLoginNode);
  const loginNode = loginNodes.find((loginNode) => loginNode.address === address);

  return loginNode;
}

// 把 ConnectError.Code 映射成 tRPC 支持的错误码
function mapConnectCodeToTRPCCode(code: Code): TRPCError["code"] {
  switch (code) {
    case Code.Canceled:
      return "CLIENT_CLOSED_REQUEST";
    case Code.InvalidArgument:
      return "BAD_REQUEST";
    case Code.Unauthenticated:
      return "UNAUTHORIZED";
    case Code.PermissionDenied:
      return "FORBIDDEN";
    case Code.NotFound:
      return "NOT_FOUND";
    case Code.AlreadyExists:
      return "CONFLICT";
    case Code.ResourceExhausted:
      return "TOO_MANY_REQUESTS";
    case Code.FailedPrecondition:
      return "PRECONDITION_FAILED";
    case Code.Aborted:
      return "CONFLICT";
    case Code.OutOfRange:
      return "BAD_REQUEST";
    case Code.Unimplemented:
      return "NOT_IMPLEMENTED";
    case Code.DeadlineExceeded:
      return "TIMEOUT";
    case Code.Unavailable:
      return "INTERNAL_SERVER_ERROR";
    case Code.Internal:
      return "INTERNAL_SERVER_ERROR";
    case Code.DataLoss:
      return "INTERNAL_SERVER_ERROR";
    case Code.Unknown:
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

// 把任意错误转换成 tRPC 的 TRPCError
export function mapConnectErrorToTRPCError(err: any): TRPCError {
  if (err instanceof ConnectError) {
    const trpcCode = mapConnectCodeToTRPCCode(err.code);
    return new TRPCError({
      code: trpcCode,
      message: err.message,
      cause: err,
    });
  }

  logger.error("Unknown error occurred", err);
  // 如果不是 ConnectError，就当作内部错误处理
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "An unknown error occurred.",
  });
}

export async function wrap<T>(p: Promise<T>, logger: Logger): Promise<T> {
  try {
    return await p;
  } catch (err: any) {
    logger.error(`Error in accessing to scowd (mapped to TRPCError),err:${err}`);
    throw mapConnectErrorToTRPCError(err);
  }
}
