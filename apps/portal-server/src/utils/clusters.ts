import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import { ClusterConfigSchema, getLoginNode } from "@scow/config/build/cluster";
import {
  createAdapterCertificates,
  getSchedulerAdapterClient,
  SchedulerAdapterClient,
} from "@scow/lib-scheduler-adapter";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource/build/utils";
import { libGetUserInfo } from "@scow/lib-server";
import { scowErrorMetadata } from "@scow/lib-server/build/error";
import {
  libCheckActivatedClusters,
  libGetCurrentActivatedClusters,
} from "@scow/lib-server/build/misCommon/clustersActivation";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";
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
export const USER_CLUSTER_PERMISSION_DENIED = "USER_CLUSTER_PERMISSION_DENIED";

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
  const activatedClusters = await libGetCurrentActivatedClusters(
    pinoLogger,
    configClusters,
    config.MIS_SERVER_URL,
    commonConfig.scowApi.auth.token,
  );

  return libCheckActivatedClusters({ clusterIds, activatedClusters, logger: pinoLogger });
};

export const checkUserClusterPermission = async ({
  userId,
  clusterIds,
  logger = pinoLogger,
}: {
  userId: string;
  clusterIds: string[] | string;
  logger?: Parameters<typeof libGetUserInfo>[0];
}) => {
  await checkActivatedClusters({ clusterIds });

  const idsToCheck = Array.isArray(clusterIds) ? clusterIds : [clusterIds];
  const userInfo = await libGetUserInfo(logger, userId, config.MIS_SERVER_URL, commonConfig.scowApi.auth.token);
  const accountNames = userInfo.affiliations.map((affiliation) => affiliation.accountName);

  const userAssociatedClusterIds = await getUserAccountsClusterIds(
    commonConfig.scowResource,
    accountNames,
    userInfo.tenantName,
  );
  const unauthorizedClusterIds = idsToCheck.filter((clusterId) => !userAssociatedClusterIds.includes(clusterId));

  if (unauthorizedClusterIds.length > 0) {
    throw new ServiceError({
      code: status.PERMISSION_DENIED,
      details: `User ${userId} is not authorized to access clusters ${unauthorizedClusterIds.join(", ")}`,
      metadata: scowErrorMetadata(USER_CLUSTER_PERMISSION_DENIED, {
        unauthorizedClusterIds: JSON.stringify(unauthorizedClusterIds),
      }),
    });
  }
};

export async function checkClusters(logger: Logger, activatedClusters: Record<string, ClusterConfigSchema>) {
  await checkClustersScowdHealth(logger, activatedClusters);
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
