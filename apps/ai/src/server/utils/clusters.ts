import { getCommonConfig } from "@scow/config/src/common";
import {
  createAdapterCertificates,
  getSchedulerAdapterClient,
} from "@scow/lib-scheduler-adapter";
import type { SchedulerAdapterClient } from "@scow/lib-scheduler-adapter";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { expandTemplatePath } from "@scow/utils";
import { TRPCError } from "@trpc/server";
import { resolve } from "path";
import { PlatformRole } from "src/models/User";
import { clusters } from "src/server/config/clusters";
import { config } from "src/server/config/env";
import { logger } from "src/server/utils/logger";
import { isParentOrSameFolder } from "src/utils/file";

export type { SchedulerAdapterClient };

export const certificates = createAdapterCertificates(config);

const adapterClientForClusters = Object.entries(clusters).reduce(
  (prev, [cluster, c]) => {
    const client = getSchedulerAdapterClient(c.adapterUrl, certificates, {
      timeoutMs: config.ADAPTER_TIMEOUT_SECONDS * 1000,
    });
    prev[cluster] = client;
    return prev;
  },
  {} as Record<string, SchedulerAdapterClient>,
);

export const getAdapterClient = (cluster: string) => {
  return adapterClientForClusters[cluster];
};

// 获取当前用户被资源管理系统授权的集群 ID 列表。
export async function getCurrentClusters(userId: string): Promise<string[]> {
  const commonConfig = getCommonConfig();
  const userAffliction = await libWebGetUserInfo(userId, config.MIS_SERVER_URL, commonConfig.scowApi.auth.token);

  const accountNames = userAffliction?.affiliations.map((a) => a.accountName);
  const tenantName = userAffliction?.tenantName;

  if (!tenantName) {
    logger.warn(`Afflicted tenant of user id: ${userId} is not found.`);
    return [];
  }
  const results = await getUserAccountsClusterIds(commonConfig.scowResource, accountNames, tenantName);

  if (results.length === 0) {
    logger.warn(`Can not find authorized clusters for the user id: ${userId}.`);
  }

  return results;
}

export const checkClusterAvailable = (clusterIds: string[], clusterId: string) => {
  if (!clusterIds.includes(clusterId)) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message:
        `Cluster id ${clusterId} is not found. ` +
        "Please confirm whether the cluster is activated or has been authorized for the login user.",
    });
  }
};

export const checkClusterPublicPaths = (
  clusterId: string,
  paths: string[],
  isPlatformAdmin: boolean,
): boolean => {
  const cluster = clusters[clusterId];
  const clusterPublicPath = cluster.ai.clusterPublicPath;

  if (!isPlatformAdmin || !clusterPublicPath) {
    return false;
  }

  return paths.every((path) => isParentOrSameFolder(clusterPublicPath, path));
};

export function isPathInEntryPaths(path: string, clusterId: string, userId: string): boolean {
  const cluster = clusters[clusterId];
  const entryPaths = cluster?.entryPaths ?? [];

  for (const entry of entryPaths) {
    for (const p of entry.paths ?? []) {
      const resolved = resolve(expandTemplatePath(p.pathTemplate, entry.mountPath, userId));
      if (isParentOrSameFolder(resolved, path)) {
        return true;
      }
    }
  }

  return false;
}

const checkEntryPaths = (clusterId: string, paths: string[], userId: string): boolean => {
  const cluster = clusters[clusterId];
  const entryPaths = cluster?.entryPaths ?? [];

  for (const entry of entryPaths) {
    if ((entry.paths ?? []).length === 0) {
      logger.warn(`Cluster ${clusterId} entry path ${entry.mountPath} has no paths configured, skipping.`);
    }
  }

  return entryPaths.length > 0 && paths.every((path) => isPathInEntryPaths(path, clusterId, userId));
};

export enum PermissionCheckMode {
  NORMAL = "NORMAL",
  PLATFORM_OWNED = "PLATFORM_OWNED",
  ENTRY_PATHS = "ENTRY_PATHS",
}

export const shouldPathsSkipPermissionCheck = (
  clusterId: string,
  paths: string[],
  userId: string,
  userPlatformRoles?: PlatformRole[] | null,
  permissionCheckMode?: PermissionCheckMode,
  homeDir?: string,
): boolean => {
  const isPlatformAdmin = userPlatformRoles?.includes(PlatformRole.PLATFORM_ADMIN) ?? false;
  const mode = permissionCheckMode ?? PermissionCheckMode.NORMAL;

  switch (mode) {
    case PermissionCheckMode.PLATFORM_OWNED:
      return checkClusterPublicPaths(clusterId, paths, isPlatformAdmin);
    case PermissionCheckMode.ENTRY_PATHS:
      return checkEntryPaths(clusterId, paths, userId);
    case PermissionCheckMode.NORMAL:
    default:
      if (homeDir) {
        const allInAllowedZone = paths.every(
          (p) => isParentOrSameFolder(homeDir, p) || isPathInEntryPaths(p, clusterId, userId),
        );
        const anyInEntryPaths = paths.some((p) => isPathInEntryPaths(p, clusterId, userId));
        return (allInAllowedZone && anyInEntryPaths) || checkClusterPublicPaths(clusterId, paths, isPlatformAdmin);
      }

      return checkEntryPaths(clusterId, paths, userId) || checkClusterPublicPaths(clusterId, paths, isPlatformAdmin);
  }
};

export const checkIsPublicPaths = (clusterId: string, paths: string[]): boolean => {
  const cluster = clusters[clusterId];
  const clusterPublicPath = cluster.ai.clusterPublicPath;

  if (!clusterPublicPath) {
    return false;
  }

  return paths.every((path) => isParentOrSameFolder(clusterPublicPath, path));
};

export function isPathAllowed(path: string, homeDir: string, clusterId: string, userId: string): boolean {
  return isParentOrSameFolder(homeDir, path) || isPathInEntryPaths(path, clusterId, userId);
}

export const computeAssetVersionNoCheckPermission = (
  clusterId: string,
  path: string,
  userId: string,
  platformRoles: PlatformRole[] | null | undefined,
  isPlatformOwned: boolean,
): boolean => {
  const mode = isPlatformOwned ? PermissionCheckMode.PLATFORM_OWNED : PermissionCheckMode.ENTRY_PATHS;
  return shouldPathsSkipPermissionCheck(clusterId, [path], userId, platformRoles, mode);
};
