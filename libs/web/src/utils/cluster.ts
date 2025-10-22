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

import { Cluster as ClusterWithConfig, ClusterConfigSchema, SimpleClusterSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";

export const getSortedClusterIds = (clusters: Record<string, Partial<SimpleClusterSchema>>): string[] => {
  return Object.keys(clusters)
    .sort(
      (a, b) => {
        return clusters[a].priority! - clusters[b].priority!;
      },
    );
};

export const getSortedClusters = (clusters: Record<string, ClusterConfigSchema>): ClusterWithConfig[] => {
  return Object.keys(clusters)
    .sort(
      (a, b) => {
        const aName = JSON.stringify(clusters[a].displayName);
        const bName = JSON.stringify(clusters[b].displayName);
        if (clusters[a].priority === clusters[b].priority) {
          return (
            aName > bName
              ? 1
              : aName === bName
                ? 0
                : -1
          );
        }
        return clusters[a].priority - clusters[b].priority;
      },
    ).map((id) => ({ id, ...clusters[id] }));
};

export interface Cluster { id: string; name: I18nStringType; };

