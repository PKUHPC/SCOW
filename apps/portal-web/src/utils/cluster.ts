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

import { Cluster } from "./config";

export function refreshDefaultCluster(
  defaultCluster: Cluster,
  currentClusters: Cluster[],
  setDefaultCluster: (cluster: Cluster) => void,
) {

  if (defaultCluster &&
    currentClusters.length > 0 &&
    !currentClusters.find((x) => x.id === defaultCluster.id)) {
    setDefaultCluster(currentClusters[0]);
  }

  if (!defaultCluster && currentClusters.length > 0) {
    setDefaultCluster(currentClusters[0]);
  }
}
