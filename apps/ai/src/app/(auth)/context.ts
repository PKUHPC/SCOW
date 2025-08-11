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

"use client";


import React, { useContext } from "react";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Cluster, PublicConfig } from "src/server/trpc/route/config";


export const PublicConfigContext = React.createContext<{
  publicConfig: PublicConfig,
  clusters: Cluster[],
  scowClusterConfigs: Record<string, { scowdEnabled: boolean,storage: { enabled: boolean,paths: string[] } }>;
  user: ClientUserInfo;
  currentAssociateClusterIds: string[],
  defaultClusterContext: {
    defaultCluster: Cluster | undefined;
    setDefaultCluster: (cluster: Cluster | undefined) => void;
    removeDefaultCluster: () => void;
  }
}>(undefined!);

export const usePublicConfig = () => {
  return useContext(PublicConfigContext);
};
