import { DesktopOps } from "src/clusterops/api/desktop";
import { configClusters } from "src/config/clusters";
import { clusterBackendNotSupported, clusterNotFound } from "src/utils/errors";

import { scowdDesktopServices } from "./scowdDesktop";

interface DesktopOpsProvider {
  supports(cluster: string): boolean;
  create(cluster: string): DesktopOps;
}

// 后续新增 desktop 后端时在这里注册 provider，不要在服务层或 route 中增加分支。
// supports() 只应在集群明确启用对应后端时返回 true，create() 必须返回完整的 DesktopOps 实现。
// provider 会按顺序匹配；如果新后端优先级高于 scowd，请放在 scowd 前面。
const desktopOpsProviders: DesktopOpsProvider[] = [
  {
    supports: (cluster) => configClusters[cluster]?.scowd?.enabled === true,
    create: (cluster) => ({
      ...scowdDesktopServices(cluster),
    }),
  },
];

export const desktopOps = (cluster: string): DesktopOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const provider = desktopOpsProviders.find((provider) => provider.supports(cluster));
  if (!provider) {
    throw clusterBackendNotSupported(cluster);
  }

  return provider.create(cluster);
};
