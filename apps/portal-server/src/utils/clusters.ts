import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import { ClusterConfigSchema, getLoginNode } from "@scow/config/build/cluster";
import {
  createAdapterCertificates,
  getSchedulerAdapterClient,
  SchedulerAdapterClient,
} from "@scow/lib-scheduler-adapter";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import {
  libCheckActivatedClusters,
  libGetCurrentActivatedClusters,
} from "@scow/lib-server/build/misCommon/clustersActivation";
import { testRootUserSshLogin } from "@scow/lib-ssh";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { config, rootKeyPair } from "src/config/env";
import { logger as pinoLogger } from "src/utils/logger";
import { Logger } from "ts-log";

import { clusterNotFound, loginNodeNotFound } from "./errors";
import { getScowdClient } from "./scowd";

export const certificates = createAdapterCertificates(config);

const clusters = configClusters;
const adapterClientForClusters = Object.entries(clusters).reduce(
  (prev, [cluster, c]) => {
    const client = getSchedulerAdapterClient(c.adapterUrl, certificates);
    prev[cluster] = client;
    return prev;
  },
  {} as Record<string, SchedulerAdapterClient>,
);

export const getAdapterClient = (cluster: string) => {
  return adapterClientForClusters[cluster];
};

type CallOnOne = <T>(
  cluster: string,
  logger: Logger,
  call: (client: SchedulerAdapterClient) => Promise<T>,
) => Promise<T>;

export const ADAPTER_CALL_ON_ONE_ERROR = "ADAPTER_CALL_ON_ONE_ERROR";

export const callOnOne: CallOnOne = async (cluster, logger, call) => {
  await checkActivatedClusters({ clusterIds: cluster });

  const client = getAdapterClient(cluster);

  if (!client) {
    throw new Error("Calling actions on non-existing cluster " + cluster);
  }

  logger.info("Calling actions on cluster " + cluster);

  return await call(client).catch((e) => {
    logger.error("Cluster ops fails at %o", e);

    const errorDetail = e instanceof Error ? e : JSON.stringify(e);

    const clusterErrorDetails = [
      {
        clusterId: cluster,
        details: errorDetail,
      },
    ];
    const reason = "Cluster ID : " + cluster + ", Details : " + errorDetail.toString();

    // 统一错误处理
    if (e instanceof Error) {
      throw new ServiceError({
        code: status.INTERNAL,
        details: reason,
        metadata: scowErrorMetadata(ADAPTER_CALL_ON_ONE_ERROR, { clusterErrors: JSON.stringify(clusterErrorDetails) }),
      });
      // 如果是已经封装过的grpc error, 直接抛出错误
    } else {
      throw e;
    }
  });
};

export const checkActivatedClusters = async ({ clusterIds }: { clusterIds: string[] | string }) => {
  if (!config.MIS_DEPLOYED) {
    return;
  }

  const activatedClusters = await libGetCurrentActivatedClusters(
    pinoLogger,
    configClusters,
    config.MIS_SERVER_URL,
    commonConfig.scowApi?.auth?.token,
  );

  return libCheckActivatedClusters({ clusterIds, activatedClusters, logger: pinoLogger });
};

export async function checkClusters(logger: Logger, activatedClusters: Record<string, ClusterConfigSchema>) {
  const scowdClusters: Record<string, ClusterConfigSchema> = {};
  const sshClusters: Record<string, ClusterConfigSchema> = {};
  Object.entries(activatedClusters).map(([id, config]) => {
    if (config.scowd?.enabled) {
      scowdClusters[id] = config;
      return;
    }
    sshClusters[id] = config;
  });
  await checkClustersRootUserLogin(logger, sshClusters);
  await checkClustersScowdHealth(logger, scowdClusters);
}

export async function checkClustersScowdHealth(logger: Logger, clusters: Record<string, ClusterConfigSchema>) {
  await Promise.all(
    Object.entries(clusters).map(async ([id, config]) => {
      const node = getLoginNode(config.loginNodes[0]);
      const client = getScowdClient(id);
      logger.info(
        "Check whether scowd is running normally on the login node %s of cluster %s.",
        node.name,
        config.displayName,
      );

      try {
        // 10s 无响应则认为异常
        await client.system.checkHealth({}, { timeoutMs: 10000 });
        logger.info("Scowd runs normally on the login node %s of cluster %s.", node.name, config.displayName);
      } catch (err) {
        logger.error(
          "scowd runs abnormally on login node %s of cluster %s.err: %o",
          node.name,
          config.displayName,
          err,
        );
      }
    }),
  );
}

/**
 * Check whether clusters can be logged in as root user
 */
export async function checkClustersRootUserLogin(logger: Logger, clusters: Record<string, ClusterConfigSchema>) {
  const checkClusterLogin = async ({ displayName, loginNodes }: ClusterConfigSchema) => {
    const node = getLoginNode(loginNodes[0]);
    logger.info("Checking if root can login to %s by login node %s", displayName, node.name);

    const error = await testRootUserSshLogin(node.address, rootKeyPair, console);
    if (error) {
      logger.info("Root cannot login to %s by login node %s. err: %o", displayName, node.name, error);
      throw error;
    } else {
      logger.info("Root can login to %s by login node %s", displayName, node.name);
    }
  };

  try {
    await Promise.all(Object.values(clusters).map(checkClusterLogin));
  } catch (error) {
    logger.error("One or more clusters failed root login check: %o", error);
  }
}

/**
 * Check whether login node is in current cluster
 */
export function checkLoginNodeInCluster(cluster: string, loginNode: string) {
  const loginNodes = configClusters[cluster]?.loginNodes.map(getLoginNode);
  if (!loginNodes) {
    throw clusterNotFound(cluster);
  }
  if (!loginNodes.map((x) => x.address).includes(loginNode)) {
    throw loginNodeNotFound(loginNode);
  }
}
