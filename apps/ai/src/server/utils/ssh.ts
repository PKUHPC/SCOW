import { getLoginNode } from "@scow/config/build/cluster";
import { SftpError, sshConnect as libConnect, SshConnectError, testRootUserSshLogin } from "@scow/lib-ssh";
import { TRPCError } from "@trpc/server";
import { NodeSSH } from "node-ssh";
import { clusters } from "src/server/config/clusters";
import { rootKeyPair } from "src/server/config/env";
import { Logger } from "ts-log";

import { clusterNotFound, loginNodeNotFound } from "./errors";

// interface NodeNetInfo {
//   address: string,
//   host: string,
//   port: number,
// }

export function getClusterLoginNode(cluster: string): string | undefined {
  const loginNode = getLoginNode(clusters[cluster]?.loginNodes?.[0]);
  return loginNode?.address;
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
      logger.error(e);
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "SSH_ERROR: " + e.message,
      });
    }

    if (e instanceof SftpError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "SFTP_ERROR: " + e.message,
      });
    }

    throw e;
  });
}

/**
 * Check whether all clusters can be logged in as root user
 */
export async function checkClustersRootUserLogin(logger: Logger) {
  await Promise.all(
    Object.values(clusters).map(async ({ displayName, loginNodes }) => {
      const node = getLoginNode(loginNodes[0]);
      logger.info("Checking if root can login to %s by login node %s", displayName, node.name);
      const error = await testRootUserSshLogin(node.address, rootKeyPair, console);
      if (error) {
        logger.info("Root cannot login to %s by login node %s. err: %o", displayName, node.name, error);
        throw error;
      } else {
        logger.info("Root can login to %s by login node %s", displayName, node.name);
      }
    }),
  );
}

/**
 * Check whether login node is in current cluster
 */
export async function checkLoginNodeInCluster(cluster: string, loginNode: string) {
  const loginNodes = clusters[cluster]?.loginNodes.map(getLoginNode);
  if (!loginNodes) {
    throw clusterNotFound(cluster);
  }
  if (!loginNodes.map((x) => x.address).includes(loginNode)) {
    throw loginNodeNotFound(loginNode);
  }
}
