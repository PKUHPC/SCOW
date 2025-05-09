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

import { SimpleClusterSchema } from "@scow/config/build/cluster";
import { I18nStringType } from "@scow/config/build/i18n";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";

export interface Cluster { id: string; name: I18nStringType; };

export const getClusterName = (
  clusterId: string,
  languageId: string,
  publicConfigClusters: Record<string, Cluster>,
) => {
  return getI18nConfigCurrentText(publicConfigClusters[clusterId]?.name, languageId) || clusterId;
};

export function getClusterNameWithUndefined(
  clusterId: string | undefined,
  languageId: string,
  publicConfigClusters: Record<string, Cluster>) {
  return clusterId ?
    getClusterName(clusterId, languageId, publicConfigClusters) : "-";
}

export const getSortedClusterValues =
  (publicConfigClusters: Record<string, Cluster>,
    clusterSortedIdList: string[],
  ): Cluster[] => {

    const sortedClusters: Cluster[] = [];
    clusterSortedIdList.forEach((clusterId) => {
      sortedClusters.push(publicConfigClusters[clusterId]);
    });

    return sortedClusters;
  };


export const getPublicConfigClusters =
  (configClusters: Record<string, Partial<SimpleClusterSchema>>):
  Record<string, Cluster> => {

    const publicConfigClusters: Record<string, Cluster> = {};

    Object.keys(configClusters).forEach((clusterId) => {
      const cluster = {
        id: clusterId,
        name: configClusters[clusterId].displayName!,
      };
      publicConfigClusters[clusterId] = cluster;
    });

    return publicConfigClusters;
  };

