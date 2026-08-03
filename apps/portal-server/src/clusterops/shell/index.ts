import { ShellOps } from "src/clusterops/api/shell";
import { configClusters } from "src/config/clusters";
import { clusterBackendNotSupported, clusterNotFound } from "src/utils/errors";

import { scowdShellServices } from "./scowdShell";

interface ShellOpsProvider {
  supports(cluster: string): boolean;
  create(cluster: string): ShellOps;
}

// 后续新增 shell 后端时在这里注册 provider，不要在服务层或 route 中增加分支。
// supports() 只应在集群明确启用对应后端时返回 true，create() 必须返回完整的 ShellOps 实现。
// provider 会按顺序匹配；如果新后端优先级高于 scowd，请放在 scowd 前面。
const shellOpsProviders: ShellOpsProvider[] = [
  {
    supports: (cluster) => configClusters[cluster]?.scowd?.enabled === true,
    create: () => ({
      ...scowdShellServices(),
    }),
  },
];

export const shellOps = (cluster: string): ShellOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const provider = shellOpsProviders.find((provider) => provider.supports(cluster));
  if (!provider) {
    throw clusterBackendNotSupported(cluster);
  }

  return provider.create(cluster);
};
