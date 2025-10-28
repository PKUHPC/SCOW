import { Logger } from "@ddadaal/tsgrpc-server";
import { LockMode, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User, UserState } from "src/entities/User";
import { getScowdClient } from "src/utils/scowd";

export interface SyncError {
  cluster: string;
  path: string;
  userId: string;
}

export async function syncUsersStorageUsage(
  em: SqlEntityManager<MySqlDriver>, logger: Logger,
  cluster?: string, path?: string, tenant?: string,
): Promise<SyncError[]> {
  logger.info("Starting to sync storage usage with params: cluster=%s, path=%s, tenant=%s", cluster, path, tenant);
  const errors: SyncError[] = [];

  try {
    // 1. Get all normal users' userIds
    const users = await em.find(User, {
      state: UserState.NORMAL,
      ...tenant ? { tenant: { name: tenant } } : {},
    }, { fields: ["userId"]});

    const userIds = users.map((user) => user.userId);
    const totalUsers = userIds.length;
    logger.info("Found %d normal users to sync", totalUsers);

    // 2. Get activated cluster configurations
    const currentActivatedClusters = await getActivatedClusters(em, logger);
    logger.debug("Activated clusters: %s", Object.keys(currentActivatedClusters).join(", "));

    if (cluster && !Object.keys(currentActivatedClusters).includes(cluster)) {
      throw new Error(`Cluster ${cluster} not activated`);
    }
    const clusterConfigs = getClusterConfigs(undefined, logger);
    const clusterNames = cluster ? [cluster] : Object.keys(currentActivatedClusters);
    logger.info("Processing clusters: %s", clusterNames.join(", "));

    // Process all clusters
    for (const cluster of clusterNames) {
      logger.info("Processing cluster: %s", cluster);
      const scowdClient = getScowdClient(cluster);
      const storagePaths = path ? [path] : clusterConfigs[cluster].storage?.paths;

      if (!clusterConfigs[cluster].storage?.enabled || !storagePaths || storagePaths.length === 0) {
        logger.warn("Cluster %s storage not enabled or no storage paths configured, skipping", cluster);
        continue;
      }

      logger.info("Cluster %s storage paths: %s", cluster, storagePaths.join(", "));

      // Process each storage path
      for (const path of storagePaths) {
        logger.info("Processing path: %s on cluster: %s", path, cluster);
        let processedUsers = 0;
        let updatedUsers = 0;
        let createdUsers = 0;

        // Process users in batches (10 users per batch)
        for (let i = 0; i < totalUsers; i += 10) {
          const userIdsSlice = userIds.slice(i, i + 10);
          logger.debug("Processing batch %d-%d: users %s", i + 1,
            Math.min(i + 10, totalUsers), userIdsSlice.join(", "));

          try {
            // Query storage quota information
            const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({
              userIds: userIdsSlice, path,
            });

            logger.debug("Retrieved quota info for %d users from scowd", userQuotaInfos.length);

            // Update storage usage
            for (const userQuotaInfo of userQuotaInfos) {
              await em.transactional(async (txEm) => {
                // 查找现有配额记录
                const existingQuota = await txEm.findOne(TenantUserStorageQuota, {
                  cluster, user: { userId: userQuotaInfo.userId },
                  path,
                }, { lockMode: LockMode.PESSIMISTIC_WRITE });

                if (existingQuota) {
                  // 更新现有记录
                  const oldUsage = existingQuota.usage;
                  existingQuota.usage = userQuotaInfo.usedStorageBytes;
                  txEm.persist(existingQuota);
                  updatedUsers++;
                  logger.debug("Updated user %s usage: %d -> %d bytes",
                    userQuotaInfo.userId, oldUsage, userQuotaInfo.usedStorageBytes);
                } else {
                  // 创建新记录
                  const user = await txEm.findOne(User, { userId: userQuotaInfo.userId });
                  if (user) {
                    const newQuota = new TenantUserStorageQuota({
                      user, cluster, path,
                      usage: userQuotaInfo.usedStorageBytes,
                    });
                    txEm.persist(newQuota);
                    createdUsers++;
                    logger.debug("Created new quota record for user %s", userQuotaInfo.userId);
                  }
                }

                // 事务会自动提交，锁立即释放
              });
            }

            processedUsers += userIdsSlice.length;
            logger.debug("Successfully processed batch, total processed: %d/%d users", processedUsers, totalUsers);

          } catch (error) {
            logger.error("Error syncing storage usage for cluster %s, path %s, userIds: %s, error: %s",
              cluster, path, userIdsSlice.join(", "), error);
            userIdsSlice.forEach((userId) => {
              errors.push({
                cluster, path, userId,
              });
            });
          }
        }

        logger.info("Completed processing path %s on cluster %s: processed=%d, updated=%d, created=%d users",
          path, cluster, processedUsers, updatedUsers, createdUsers);
      }
    }

    logger.info("Storage usage sync completed. Total errors: %d", errors.length);
    if (errors.length > 0) {
      logger.warn("Sync errors occurred for: %s",
        errors.map((e) => `${e.userId}@${e.cluster}:${e.path}`).join(", "));
    }

    return errors;
  } catch (error) {
    logger.error("Global error in storage usage synchronization: %s", error);
    throw error;
  }
}
