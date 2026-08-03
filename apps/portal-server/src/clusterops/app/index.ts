import { AppOps } from "src/clusterops/api/app";
import { configClusters } from "src/config/clusters";
import { clusterBackendNotSupported, clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";

import { scowdAppServices } from "./scowdApp";

interface AppOpsProvider {
  supports(cluster: string): boolean;
  create(cluster: string): AppOps;
}

// 后续新增 app 后端时在这里注册 provider，不要在服务层或 route 中增加分支。
// supports() 只应在集群明确启用对应后端时返回 true，create() 必须返回完整的 AppOps 实现。
// provider 会按顺序匹配；如果新后端优先级高于 scowd，请放在 scowd 前面。
const appOpsProviders: AppOpsProvider[] = [
  {
    supports: (cluster) => configClusters[cluster]?.scowd?.enabled === true,
    create: (cluster) => {
      const getClient = (userId: string) => getScowdClient(cluster, userId);

      return {
        ...scowdAppServices(cluster, getClient),
      };
    },
  },
];

export const appOps = (cluster: string): AppOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const provider = appOpsProviders.find((provider) => provider.supports(cluster));
  if (!provider) {
    throw clusterBackendNotSupported(cluster);
  }

  return provider.create(cluster);
};
