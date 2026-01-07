/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { encodeMessage, ErrorInfo } from "@scow/rich-error-model";

export const errorInfo = (reason: string) =>
  encodeMessage(ErrorInfo, { domain: "", reason: reason, metadata: {} });

type ClusterIdSource = Record<string, unknown> | string[];

const toClusterIds = (clusters: ClusterIdSource) => Array.isArray(clusters) ? clusters : Object.keys(clusters);

/**
 * 根据 sessionId 前缀解析所属集群 ID，使用最长匹配前缀避免误判。
 */
export const getClusterIdFromSessionId = (sessionId: string | undefined, clusters: ClusterIdSource) => {
  if (!sessionId) { return undefined; }

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
  if (!sessionId) { return false; }

  const matchedClusterId = getClusterIdFromSessionId(sessionId, clusters);

  if (!matchedClusterId) {
    return true;
  }

  return matchedClusterId === currentClusterId;
};
