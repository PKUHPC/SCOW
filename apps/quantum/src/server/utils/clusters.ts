import { getCommonConfig } from "@scow/config/build/common";
import { createAdapterCertificates } from "@scow/lib-scheduler-adapter";
import { getSchedulerAdapterClient, SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource";
import { libGetClustersRuntimeInfo } from "@scow/lib-web/build/server/clustersActivation";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { ClusterActivationStatus } from "@scow/protos/build/server/config";
import { TRPCError } from "@trpc/server";
import { clusters } from "src/server/config/clusters";
import { config } from "src/server/config/env";
import { logger } from "src/server/utils/logger";

export const certificates = createAdapterCertificates(config);

const adapterClientForClusters = Object.entries(clusters).reduce((prev, [cluster, c]) => {
  const client = getSchedulerAdapterClient(c.adapterUrl, certificates);
  prev[cluster] = client;
  return prev;
}, {} as Record<string, SchedulerAdapterClient>);

export const getAdapterClient = (cluster: string) => {
  return adapterClientForClusters[cluster];
};


// 获取用户的当前可用集群
// (1) 如果没有部署管理系统且资源管理系统为不可用，返回当前系统已配置集群ID
// (2) 如果部署了管理系统，没有部署资源管理，则返回管理系统在线集群ID
// (3) 如果部署了管理系统和资源管理，则返回已授权的在线集群ID
export async function getCurrentClusters(userId: string): Promise<string[]> {

  const commonConfig = getCommonConfig();

  // 如果没有部署管理系统或者资源管理系统为不可用，返回当前系统已配置集群ID
  if (!config.MIS_SERVER_URL || !commonConfig.scowResource?.enabled) {
    return clusters ? Object.keys(clusters) : [];
  }
  if (!commonConfig.scowResource?.enabled) {
    // 如果没有部署管理系统且资源管理系统为不可用
    if (!config.MIS_SERVER_URL) {
      const configClusterIds = clusters ? Object.keys(clusters) : [];
      if (configClusterIds.length === 0) {
        logger.warn("No cluster config is found.");
      }
      return configClusterIds;
    // 如果部署了管理系统，没有部署资源管理
    } else {
      const currentClusters = await libGetClustersRuntimeInfo(config.MIS_SERVER_URL,
        commonConfig.scowApi?.auth?.token);
      const activatedClusterIds = currentClusters.filter((c) =>
        (c.activationStatus === ClusterActivationStatus.ACTIVATED)).map((c) => (c.clusterId));
      if (activatedClusterIds.length === 0) {
        logger.warn("No available activated clusters.");
      }
      return activatedClusterIds;
    }
  }

  // 如果部署了管理系统且部署了资源管理
  const userAffliction
       = await libWebGetUserInfo(userId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);

  const accountNames = userAffliction?.affiliations.map((a) => (a.accountName));
  const tenantName = userAffliction?.tenantName;

  if (!tenantName) {
    logger.info(`Afflicted tenant of user id: ${userId} is not found.`);
    return [];
  }
  const results
       = await getUserAccountsClusterIds(commonConfig.scowResource, accountNames, tenantName);

  if (results.length === 0) {
    logger.info(`Can not find authorized clusters for the user id: ${userId}.`);
  }

  return results;
}


export const checkClusterAvailable = (clusterIds: string[], clusterId: string) => {

  if (!clusterIds.includes(clusterId)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Cluster id ${clusterId} is not found. ` +
        "Please confirm whether the cluster is activated or has been authorized for the login user.",
    });
  }
};
