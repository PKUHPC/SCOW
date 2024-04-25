/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Code } from "@connectrpc/connect";
import { status } from "@grpc/grpc-js";
import { getLoginNode } from "@scow/config/build/cluster";
import { getScowdClient as getClient, ScowdClient } from "@scow/lib-scowd/build/client";
import { createScowdCertificates } from "@scow/lib-scowd/build/ssl";
import { clusters } from "src/config/clusters";
import { config } from "src/config/env";

export const certificates = createScowdCertificates(config);

export function getLoginNodeScowdUrl(cluster: string, host: string): string | undefined {
  const loginNode = getLoginNodeFromAddress(cluster, host);

  if (!loginNode) return undefined;

  const { address, scowdPort } = loginNode;
  return config.SCOWD_SSL_ENABLED ? `https://${address}:${scowdPort}` : `http://${address}:${scowdPort}`;
}

const scowdClientForClusters = Object.entries(clusters).reduce((prev, [cluster]) => {
  const clusterInfo = clusters[cluster];
  const loginNode = getLoginNode(clusterInfo?.loginNodes?.[0]);
  const scowdUrl = getLoginNodeScowdUrl(cluster, loginNode.address);
  if (!clusterInfo.scowd?.enabled || !loginNode.scowdPort || !scowdUrl) {
    prev[cluster] = undefined;
  } else {
    const client = getClient(scowdUrl, certificates);
    prev[cluster] = client;
  }
  return prev;
}, {} as Record<string, ScowdClient | undefined>);

export const getScowdClient = (cluster: string) => {
  return scowdClientForClusters[cluster];
};

export function getLoginNodeFromAddress(cluster: string, address: string) {
  const clusterInfo = clusters[cluster];
  const loginNodes = clusterInfo?.loginNodes.map(getLoginNode);
  const loginNode = loginNodes.find((loginNode) => loginNode.address === address);

  return loginNode;
}

// 函数将 Code 转换为 @grpc/grpc-js 的 status
export function convertCodeToGrpcStatus(code: Code): status {
  switch (code) {
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
