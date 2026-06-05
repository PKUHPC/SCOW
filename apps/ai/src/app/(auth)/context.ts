"use client";

import React, { useContext } from "react";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Cluster, PublicConfig } from "src/server/trpc/route/config";

export type ScowClusterConfigs = Record<
  string,
  {
    scowdEnabled: boolean;
    storage: { enabled: boolean; replicaExist: boolean; paths: string[] };
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
  // 当前登录用户的可用 集群ID 列表
  // (1) 如果没有部署管理系统且资源管理系统为不可用，返回当前系统已配置集群ID
  // (2) 如果部署了管理系统，没有部署资源管理，则返回管理系统在线集群ID
  // (3) 如果部署了管理系统和资源管理，则返回已授权的在线集群ID
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
