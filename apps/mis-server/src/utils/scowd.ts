import { Code } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getLoginNode } from "@scow/config/build/cluster";
import { createBalancedScowdClientGetter } from "@scow/lib-scowd/build/client";
import { createScowdCertificates } from "@scow/lib-scowd/build/ssl";
import { removePort } from "@scow/utils";
import { configClusters } from "src/config/clusters";
import { config } from "src/config/env";
import { logger } from "src/utils/logger";

export const scowdClientNotFound = (cluster: string) => {
  return { code: Status.NOT_FOUND, message: `The scowd client on cluster ${cluster} was not found` } as ServiceError;
};
export const certificates = createScowdCertificates(config);

export function generateScowdUrl(address: string, scowdPort: number | undefined) {
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

const getClientByCluster = createBalancedScowdClientGetter({
  getClusterIds: () => Object.keys(configClusters),
  getClusterInfo: (cluster) => configClusters[cluster],
  getLoginNodes: (clusterInfo) => clusterInfo?.loginNodes,
  getLoginNode,
  getLoginNodeAddress: (loginNode) => loginNode.address,
  getLoginNodeScowdUrl,
  isScowdEnabled: (clusterInfo) => !!clusterInfo?.scowd?.enabled,
  certificates,
  logger,
});

export const getScowdClient = (cluster: string, userId?: string) => {
  const client = getClientByCluster(cluster, userId);
  if (!client) {
    throw scowdClientNotFound(cluster);
  }
  return client;
};

export function getLoginNodeFromAddress(cluster: string, address: string) {
  const clusterInfo = configClusters[cluster];
  const loginNodes = clusterInfo?.loginNodes.map(getLoginNode);
  const loginNode = loginNodes.find((loginNode) => loginNode.address === address);

  return loginNode;
}

// 映射 connectRPC 状态码到 gRPC 状态码的函数
export function mapConnectRpcStatusToGrpc(statusCode: Code): status {
  switch (statusCode) {
    case Code.Canceled:
      return status.CANCELLED;
    case Code.Unknown:
      return status.UNKNOWN;
    case Code.InvalidArgument:
      return status.INVALID_ARGUMENT;
    case Code.DeadlineExceeded:
      return status.DEADLINE_EXCEEDED;
    case Code.NotFound:
      return status.NOT_FOUND;
    case Code.AlreadyExists:
      return status.ALREADY_EXISTS;
    case Code.PermissionDenied:
      return status.PERMISSION_DENIED;
    case Code.ResourceExhausted:
      return status.RESOURCE_EXHAUSTED;
    case Code.FailedPrecondition:
      return status.FAILED_PRECONDITION;
    case Code.Aborted:
      return status.ABORTED;
    case Code.OutOfRange:
      return status.OUT_OF_RANGE;
    case Code.Unimplemented:
      return status.UNIMPLEMENTED;
    case Code.Internal:
      return status.INTERNAL;
    case Code.Unavailable:
      return status.UNAVAILABLE;
    case Code.DataLoss:
      return status.DATA_LOSS;
    case Code.Unauthenticated:
      return status.UNAUTHENTICATED;
    default:
      return status.OK;
  }
}
