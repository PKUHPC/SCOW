"use client";

import { buildEnrichedEntryPaths } from "@scow/lib-web/build/utils/storageClusterHelper";
import { useMemo } from "react";
import { usePublicConfig } from "src/app/(auth)/context";

export const useClusterEntryPathRoots = (clusterId?: string): string[] => {
  const { scowClusterConfigs, user } = usePublicConfig();

  return useMemo(() => {
    const entryPaths = clusterId ? scowClusterConfigs[clusterId]?.entryPaths : undefined;
    return buildEnrichedEntryPaths(entryPaths, user?.identityId).map(({ resolvedPath }) => resolvedPath);
  }, [clusterId, scowClusterConfigs, user?.identityId]);
};
