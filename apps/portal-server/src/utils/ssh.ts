import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import { getLoginNode } from "@scow/config/build/cluster";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import { SftpError, sshConnect as libConnect, SshConnectError } from "@scow/lib-ssh";
import { NodeSSH } from "node-ssh";
import { configClusters } from "src/config/clusters";
import { rootKeyPair } from "src/config/env";
import { Logger } from "ts-log";

import { transferNodeNotFound, transferNotEnabled } from "./errors";

interface NodeNetInfo {
  address: string;
  host: string;
  port: number;
}

// 获取配置文件集群中各节点信息
export function getConfigClusterLoginNode(cluster: string): string | undefined {
  const loginNode = getLoginNode(configClusters[cluster]?.loginNodes?.[0]);
  return loginNode?.address;
}

// 获取集群中各节点信息
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
  // 解析为host, port
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
  // 解析为host, port
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

export const SSH_ERROR_CODE = "SSH_ERROR";
export const SFTP_ERROR_CODE = "SFTP_ERROR";

export async function sshConnect<T>(
  address: string,
  username: string,
  logger: Logger,
  run: (ssh: NodeSSH) => Promise<T>,
): Promise<T> {
  return libConnect(address, username, rootKeyPair, logger, run).catch((e) => {
    if (e instanceof SshConnectError) {
      throw new ServiceError({
        code: status.INTERNAL,
        details: e.message,
        message: e.message,
        metadata: scowErrorMetadata(
          SSH_ERROR_CODE,
          typeof e.cause === "string"
            ? e.cause.length > 150
              ? { cause: encodeURIComponent(e.cause.substring(0, 150) + "...") }
              : { cause: encodeURIComponent(e.cause) }
            : undefined,
        ),
      });
    }

    if (e instanceof SftpError) {
      throw new ServiceError({
        code: status.UNKNOWN,
        details: e.message,
        message: e.message,
        metadata: scowErrorMetadata(SFTP_ERROR_CODE),
      });
    }

    throw e;
  });
}
