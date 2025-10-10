"use client";


import React, { useContext } from "react";
import { ClientUserInfo } from "src/server/trpc/route/auth";
import { Cluster, PublicConfig } from "src/server/trpc/route/config";

export type ScowClusterConfigs = Record<string, {
  scowdEnabled: boolean,
  storage: { enabled: boolean, replicaExist: boolean, paths: string[] },
  ai: { devHost: { enabled: boolean, vscodeInfo: { binPath: string }, maxRunningTimeHours?: number } },
}>;

export const PublicConfigContext = React.createContext<{
  publicConfig: PublicConfig,
  clusters: Cluster[],
  scowClusterConfigs: ScowClusterConfigs;
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
