import { ClusterConfigSchema } from "@scow/config/build/cluster";

// 校验所有 ai.enabled=true 的集群是否配置了 clusterPublicPath，未配置则抛出错误。
export function validateClusterAiConfig(
  clusters: Record<string, ClusterConfigSchema>,
  scowConfigPath: string,
) {
  Object.entries(clusters).forEach(([clusterId, cluster]) => {
    if (!cluster.ai?.enabled) {
      return;
    }

    if (cluster.ai.clusterPublicPath?.trim()) {
      return;
    }

    throw new Error(
      `Invalid config: cluster '${clusterId}' has ai.enabled=true but missing ai.clusterPublicPath. `
      + `Please edit '${scowConfigPath}/clusters/${clusterId}.yaml' and add ai.clusterPublicPath. `
      + "Example:\n"
      + "ai:\n"
      + "  enabled: true\n"
      + "  # Example value only. Replace it with your actual public asset directory.\n"
      + "  clusterPublicPath: \"/nfs/.public\"",
    );
  });
}
