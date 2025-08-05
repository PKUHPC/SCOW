import { getCommonConfig } from "@scow/config/build/common";
import { createAdapterCertificates } from "@scow/lib-scheduler-adapter";
import { getSchedulerAdapterClient, SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
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

export async function getCurrentClusters(userId: string): Promise<string[]> {

  const commonConfig = getCommonConfig();

  // 如果没有部署管理系统或者资源管理系统为不可用，返回当前系统已配置集群ID
  if (!config.MIS_SERVER_URL || !commonConfig.scowResource?.enabled) {
    return clusters ? Object.keys(clusters) : [];
  }

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
        "Please confirm whether the cluster has been authorized for the login user.",
    });
  }
};
