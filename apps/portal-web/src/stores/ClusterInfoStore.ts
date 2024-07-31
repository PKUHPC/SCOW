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

import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { getSortedClusterIds } from "@scow/lib-web/build/utils/cluster";
import { useLocalStorage } from "@scow/lib-web/build/utils/hooks";
import { useEffect, useState } from "react";
import { Cluster, getDesktopEnabled, getFileTransferEnabled, getPublicConfigClusters } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

const SCOW_DEFAULT_CLUSTER_ID = "SCOW_DEFAULT_CLUSTER_ID";

export function ClusterInfoStore(
  clusterConfigs: Record<string, ClusterConfigSchema>,
  initialCurrentClusters: Cluster[],
  // 用于获取桌面功能是否可用，如集群配置文件中没有配置则判断门户的配置文件
  portalRuntimeDesktopEnabled: boolean,
  // 用户关联账户的已授权集群信息
  userAssociatedClusterIds: string[] | undefined,
) {

  // 配置文件集群信息
  const publicConfigClusters = getPublicConfigClusters(clusterConfigs);

  // 配置文件按集群优先级排序的集群id列表
  const clusterSortedIdList = getSortedClusterIds(clusterConfigs);

  // 当前可用集群
  const [currentClusters, setCurrentClusters] = useState<Cluster[]>(!publicConfig.MIS_DEPLOYED
    ? publicConfigClusters : initialCurrentClusters);

  useEffect(() => {
    if (userAssociatedClusterIds) {
      const filteredClusters = initialCurrentClusters
        .filter((x) => userAssociatedClusterIds.includes(x.id));
  
      setCurrentClusters(filteredClusters);
    }
  }, [userAssociatedClusterIds, initialCurrentClusters]);

  const initialDefaultClusterId = clusterSortedIdList.find((x) => {
    return currentClusters.find((c) => c.id === x);
  });

  const [clusterId, setClusterId] = useLocalStorage<string>(
    SCOW_DEFAULT_CLUSTER_ID,
    initialDefaultClusterId || "",
  );

  // 默认集群
  const defaultCluster: Cluster | undefined = currentClusters.find((cluster) => cluster.id === clusterId)
  || currentClusters[0] || undefined;

  const setDefaultCluster = (cluster: Cluster | undefined) => {
    setClusterId(cluster?.id ?? "");
  };

  const removeDefaultCluster = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SCOW_DEFAULT_CLUSTER_ID);
    }
  };

  // ENABLE_LOGIN_DESKTOP
  const initialEnableLoginDesktop = getDesktopEnabled(clusterConfigs, portalRuntimeDesktopEnabled);
  const [enableLoginDesktop, setEnableLoginDesktop] = useState<boolean>(initialEnableLoginDesktop);


  // CROSS_CLUSTER_FILE_TRANSFER_ENABLED
  const initialEnableFileTransfer = getFileTransferEnabled(clusterConfigs);
  const [crossClusterFileTransferEnabled, setCrossClusterFileTransferEnabled]
   = useState<boolean>(initialEnableFileTransfer);

  useEffect(() => {

    if (publicConfig.MIS_DEPLOYED) {
      // 可用集群不存在时
      if (currentClusters.length === 0) {
        setDefaultCluster(undefined);
        setEnableLoginDesktop(false);
        setCrossClusterFileTransferEnabled(false);
      } else {

        const currentClusterIds = currentClusters.map((x) => x.id);
        const specifiedClusterConfigs = Object.fromEntries(
          Object.entries(clusterConfigs).filter(([clusterId]) => currentClusterIds.includes(clusterId)),
        );

        // set桌面功能是否可用
        const currentEnableLoginDesktop = getDesktopEnabled(clusterConfigs, portalRuntimeDesktopEnabled);
        setEnableLoginDesktop(currentEnableLoginDesktop);

        // set文件传输功能是否可用
        const currentCrossClusterFileTransferEnabled = getFileTransferEnabled(specifiedClusterConfigs);
        setCrossClusterFileTransferEnabled(currentCrossClusterFileTransferEnabled);

        // set默认集群
        // 上一次记录的集群为undefined的情况，使用可用集群中的某一个集群作为新的默认集群
        if (!defaultCluster?.id) {
          setDefaultCluster(currentClusters[0]);

          // 上一次记录的默认集群已不在可用集群中的情况
        } else {
          const currentDefaultExists = currentClusters.find((x) => x.id === defaultCluster?.id);
          if (!currentDefaultExists) {
            setDefaultCluster(currentClusters[0]);
          }
        }
      }
    }

  }, [currentClusters, clusterConfigs, portalRuntimeDesktopEnabled]);

  return {
    publicConfigClusters,
    clusterSortedIdList,
    currentClusters,
    setCurrentClusters,
    defaultCluster: defaultCluster as Cluster | undefined,
    setDefaultCluster,
    removeDefaultCluster,
    enableLoginDesktop,
    crossClusterFileTransferEnabled,
  };
}
