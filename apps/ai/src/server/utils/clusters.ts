import { ChannelCredentials } from "@grpc/grpc-js";
import { getCommonConfig } from "@scow/config/src/common";
import { createAdapterCertificates } from "@scow/lib-scheduler-adapter";
import { SslConfig } from "@scow/lib-scheduler-adapter/build/ssl";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource";
import { libGetClustersRuntimeInfo } from "@scow/lib-web/build/server/clustersActivation";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { ClusterActivationStatus } from "@scow/protos/build/server/config";
import { AccountServiceClient } from "@scow/scheduler-adapter-protos/build/account";
import { AppServiceClient } from "@scow/scheduler-adapter-protos/build/app";
import { ConfigServiceClient } from "@scow/scheduler-adapter-protos/build/config";
import { JobServiceClient } from "@scow/scheduler-adapter-protos/build/job";
import { UserServiceClient } from "@scow/scheduler-adapter-protos/build/user";
import { VersionServiceClient } from "@scow/scheduler-adapter-protos/build/version";
import { TRPCError } from "@trpc/server";
import { clusters } from "src/server/config/clusters";
import { config } from "src/server/config/env";
import { logger } from "src/server/utils/logger";
import { isParentOrSameFolder } from "src/utils/file";

type ClientConstructor<TClient> = new (address: string, credentials: ChannelCredentials) => TClient;

export interface SchedulerAdapterClient {
  account: AccountServiceClient;
  user: UserServiceClient;
  job: JobServiceClient;
  config: ConfigServiceClient;
  version: VersionServiceClient;
  app: AppServiceClient;
}

export function getClient<TClient>(address: string, sslConfig: SslConfig, ctor: ClientConstructor<TClient>): TClient {
  if (sslConfig.enabled) {
    return new ctor(address, ChannelCredentials.createSsl(sslConfig.ca, sslConfig.key, sslConfig.cert));
  }

  return new ctor(address, ChannelCredentials.createInsecure());
}

export const certificates = createAdapterCertificates(config);

export const getSchedulerAdapterClient = (address: string, sslConfig: SslConfig) => {
  return {
    account: getClient(address, sslConfig, AccountServiceClient),
    user: getClient(address, sslConfig, UserServiceClient),
    job: getClient(address, sslConfig, JobServiceClient),
    config: getClient(address, sslConfig, ConfigServiceClient),
    version: getClient(address, sslConfig, VersionServiceClient),
    app: getClient(address, sslConfig, AppServiceClient),
  } as SchedulerAdapterClient;
};

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

// 获取用户的当前可用集群
// (1) 如果没有部署管理系统且资源管理系统为不可用，返回当前系统已配置集群ID
// (2) 如果部署了管理系统，没有部署资源管理，则返回管理系统在线集群ID
// (3) 如果部署了管理系统和资源管理，则返回已授权的在线集群ID
export async function getCurrentClusters(userId: string): Promise<string[]> {
  const commonConfig = getCommonConfig();

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
      const currentClusters = await libGetClustersRuntimeInfo(config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);
      const activatedClusterIds = currentClusters
        .filter((c) => c.activationStatus === ClusterActivationStatus.ACTIVATED)
        .map((c) => c.clusterId);
      if (activatedClusterIds.length === 0) {
        logger.warn("No available activated clusters.");
      }
      return activatedClusterIds;
    }
  }

  // 如果部署了管理系统且部署了资源管理
  const userAffliction = await libWebGetUserInfo(userId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);

  const accountNames = userAffliction?.affiliations.map((a) => a.accountName);
  const tenantName = userAffliction?.tenantName;

  if (!tenantName) {
    logger.warn(`Afflicted tenant of user id: ${userId} is not found.`);
    return [];
  }
  const results = await getUserAccountsClusterIds(commonConfig.scowResource, accountNames, tenantName);

  if (results.length === 0) {
    logger.warn(`Can not find authorized clusters for the user id: ${userId}.`);
  }

  return results;
}

export const checkClusterAvailable = (clusterIds: string[], clusterId: string) => {
  if (!clusterIds.includes(clusterId)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        `Cluster id ${clusterId} is not found. ` +
        "Please confirm whether the cluster is activated or has been authorized for the login user.",
    });
  }
};

export const shouldPathsSkipPermissionCheck = (
  clusterId: string,
  paths: string[],
  isPlatformAdmin: boolean,
): boolean => {
  const cluster = clusters[clusterId];
  const clusterPublicPath = cluster.ai.clusterPublicPath;

  if (!isPlatformAdmin || !clusterPublicPath) {
    return false;
  }

  return paths.every((path) => isParentOrSameFolder(clusterPublicPath, path));
};

export const checkIsPublicPaths = (clusterId: string, paths: string[]): boolean => {
  const cluster = clusters[clusterId];
  const clusterPublicPath = cluster.ai.clusterPublicPath;

  if (!clusterPublicPath) {
    return false;
  }

  return paths.every((path) => isParentOrSameFolder(clusterPublicPath, path));
};
