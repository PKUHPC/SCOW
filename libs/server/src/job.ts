import { encodeMessage, ErrorInfo } from "@scow/rich-error-model";

export const errorInfo = (reason: string) => encodeMessage(ErrorInfo, { domain: "", reason: reason, metadata: {} });

type ClusterIdSource = Record<string, unknown> | string[];

const toClusterIds = (clusters: ClusterIdSource) => (Array.isArray(clusters) ? clusters : Object.keys(clusters));

/**
 * 根据 sessionId 前缀解析所属集群 ID，使用最长匹配前缀避免误判。
 */
export const getClusterIdFromSessionId = (sessionId: string | undefined, clusters: ClusterIdSource) => {
  if (!sessionId) {
    return undefined;
  }

  const clusterIds = toClusterIds(clusters);

  return clusterIds.reduce<string | undefined>((matchedClusterId, clusterId) => {
    if (!sessionId.startsWith(`${clusterId}-`)) {
      return matchedClusterId;
    }

    if (!matchedClusterId || clusterId.length > matchedClusterId.length) {
      return clusterId;
    }

    return matchedClusterId;
  }, undefined);
};

/**
 * sessionId 匹配当前集群或无法解析集群时返回 true。
 */
export const isCurrentClusterSession = (
  sessionId: string | undefined,
  currentClusterId: string,
  clusters: ClusterIdSource,
) => {
  if (!sessionId) {
    return false;
  }

  const matchedClusterId = getClusterIdFromSessionId(sessionId, clusters);

  if (!matchedClusterId) {
    return true;
  }

  return matchedClusterId === currentClusterId;
};
