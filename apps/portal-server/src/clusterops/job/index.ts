import { JobOps, JobTemplate } from "src/clusterops/api/job";
import { configClusters } from "src/config/clusters";
import { clusterBackendNotSupported, clusterNotFound } from "src/utils/errors";
import { getScowdClient } from "src/utils/scowd";

import { scowdJobServices } from "./scowdJob";

export interface JobMetadata extends JobTemplate {
  submitTime: string;
}

interface JobOpsProvider {
  supports(cluster: string): boolean;
  create(cluster: string): JobOps;
}

// 后续新增 job 后端时在这里注册 provider，不要在服务层或 route 中增加分支。
// supports() 只应在集群明确启用对应后端时返回 true，create() 必须返回完整的 JobOps 实现。
// provider 会按顺序匹配；如果新后端优先级高于 scowd，请放在 scowd 前面。
const jobOpsProviders: JobOpsProvider[] = [
  {
    supports: (cluster) => configClusters[cluster]?.scowd?.enabled === true,
    create: (cluster) => {
      const getClient = (userId: string) => getScowdClient(cluster, userId);

      return {
        ...scowdJobServices(getClient),
      };
    },
  },
];

export const jobOps = (cluster: string): JobOps => {
  const clusterInfo = configClusters[cluster];
  if (!clusterInfo) {
    throw clusterNotFound(cluster);
  }

  const provider = jobOpsProviders.find((provider) => provider.supports(cluster));
  if (!provider) {
    throw clusterBackendNotSupported(cluster);
  }

  return provider.create(cluster);
};
