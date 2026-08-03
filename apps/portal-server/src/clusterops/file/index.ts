import { FileOps } from "src/clusterops/api/file";
import { configClusters } from "src/config/clusters";
import { clusterBackendNotSupported, clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";

import { scowdFileServices } from "./scowdFile";

interface FileOpsProvider {
  supports(cluster: string): boolean;
  create(cluster: string): FileOps;
}

// 后续新增 file 后端时在这里注册 provider，不要在服务层或 route 中增加分支。
// supports() 只应在集群明确启用对应后端时返回 true，create() 必须返回完整的 FileOps 实现。
// provider 会按顺序匹配；如果新后端优先级高于 scowd，请放在 scowd 前面。
const fileOpsProviders: FileOpsProvider[] = [
  {
    supports: (cluster) => configClusters[cluster]?.scowd?.enabled === true,
    create: (cluster) => {
      const getClient = (userId: string) => getScowdClient(cluster, userId);

      return {
        ...scowdFileServices(getClient),
      };
    },
  },
];

export const fileOps = (cluster: string): FileOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const provider = fileOpsProviders.find((provider) => provider.supports(cluster));
  if (!provider) {
    throw clusterBackendNotSupported(cluster);
  }

  return provider.create(cluster);
};
