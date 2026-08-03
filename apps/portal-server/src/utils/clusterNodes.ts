import { getLoginNode } from "@scow/config/build/cluster";
import { configClusters } from "src/config/clusters";

import { transferNodeNotFound, transferNotEnabled } from "./errors";

interface NodeNetInfo {
  address: string;
  host: string;
  port: number;
}

export function getClusterLoginNode(cluster: string): string | undefined {
  const loginNode = getLoginNode(configClusters[cluster]?.loginNodes?.[0]);
  return loginNode?.address;
}

export function getClusterTransferNode(cluster: string): NodeNetInfo {
  const enabled = configClusters[cluster]?.crossClusterFileTransfer?.enabled;
  const transferNode = configClusters[cluster]?.crossClusterFileTransfer?.transferNode;
  if (!enabled) {
    throw transferNotEnabled(cluster);
  } else if (!transferNode) {
    throw transferNodeNotFound(cluster);
  }
  const [host, port] =
    transferNode.indexOf(":") > 0
      ? [transferNode.split(":")[0], parseInt(transferNode.split(":")[1])]
      : [transferNode, 22];
  const address = `${host}:${port}`;
  return {
    address: address,
    host: host,
    port: port,
  };
}

export function tryGetClusterTransferNode(cluster: string): NodeNetInfo | undefined {
  const enabled = configClusters[cluster]?.crossClusterFileTransfer?.enabled;
  const transferNode = configClusters[cluster]?.crossClusterFileTransfer?.transferNode;
  if (!enabled) {
    return undefined;
  } else if (!transferNode) {
    return undefined;
  }
  const [host, port] =
    transferNode.indexOf(":") > 0
      ? [transferNode.split(":")[0], parseInt(transferNode.split(":")[1])]
      : [transferNode, 22];
  const address = `${host}:${port}`;
  return {
    address: address,
    host: host,
    port: port,
  };
}
