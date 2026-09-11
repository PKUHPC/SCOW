"use client";

import React, { useContext } from "react";
import { ClusterEntryPath } from "src/models/ClusterStorage";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Cluster, LoginNodeConfig, PublicConfig } from "src/server/trpc/route/config";

export type ScowClusterConfigs = Record<
  string,
  {
    entryPaths?: ClusterEntryPath[];
    loginNodes: LoginNodeConfig;
    ai: {
      app?: { maxRunningTimeHours?: number };
      train?: { maxRunningTimeHours?: number };
      infer?: { maxRunningTimeHours?: number };
      devHost: { enabled: boolean; vscodeInfo: { binPath: string }; maxRunningTimeHours?: number };
      clusterPublicPath: string;
    };
  }
>;

export const PublicConfigContext = React.createContext<{
  publicConfig: PublicConfig;
  // 系统所有已配置集群 ID，名称 列表
  clusters: Cluster[];
  scowClusterConfigs: ScowClusterConfigs;
  user: ClientUserInfo;
  // 当前登录用户已授权且已配置于 AI 系统的集群 ID 列表
  currentAvailableClusterIds: string[];
  defaultClusterContext: {
    defaultCluster: Cluster | undefined;
    setDefaultCluster: (cluster: Cluster | undefined) => void;
    removeDefaultCluster: () => void;
  };
}>(undefined!);

export const usePublicConfig = () => {
  return useContext(PublicConfigContext);
};
