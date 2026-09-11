import { Logger } from "@ddadaal/tsgrpc-server";
import { LockMode, MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { buildStorageConfigProto, getExecutableStorageIds } from "@scow/lib-server";
import dayjs from "@scow/lib-server/build/date";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { DailyStorageUsage } from "src/entities/DailyStorageUsage";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User, UserState } from "src/entities/User";
import { getScowdClient } from "src/utils/scowd";
import { executeStorageOperationWithFailoverWithContext } from "src/utils/storageExecutionTarget";
import { buildStorageQuotaExecutionFields } from "src/utils/storageQuotaRecord";

export interface SyncError {
  storageId: string;
  userId: string;
}

export async function syncUsersStorageUsage(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  storageId?: string,
  tenant?: string,
): Promise<SyncError[]> {
  logger.info(
    "Starting to sync storage usage with params: storageId=%s, tenant=%s",
    storageId,
    tenant,
  );
  const errors: SyncError[] = [];

  try {
    const clusterConfigs = getClusterConfigs(undefined, logger);
    const currentActivatedClusters = await getActivatedClusters(em, logger);
    const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
    const executableStorageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);
    const storageIds = storageId ? [storageId] : executableStorageIds;

    if (storageIds.length === 0) {
      logger.info(
        { requestedStorageId: storageId, activatedClusterIds: [...activatedClusterIds] },
        "No quota-enabled storage is available on activated clusters; skipping user storage usage sync",
      );
      return [];
    }

    // 先确定本轮需要同步哪些用户。tenant 为空时代表全平台同步。
    const users = await em.find(
      User,
      {
        state: UserState.NORMAL,
        ...(tenant ? { tenant: { name: tenant } } : {}),
      },
      { fields: ["userId"] },
    );

    const userIds = users.map((user) => user.userId);
    if (userIds.length === 0) {
      return [];
    }

    logger.info("Starting storage usage sync", { storageIds, tenant, userCount: userIds.length });

    for (const currentStorageId of storageIds) {
      const storageExecutionContext = { clusterConfigs, activatedClusterIds };
      // 每批同步一部分用户，避免单次请求过大。
      for (let i = 0; i < userIds.length; i += 10) {
        const userIdsSlice = userIds.slice(i, i + 10);

        try {
          const { executionCluster, executionPath, result } = await executeStorageOperationWithFailoverWithContext(
            currentStorageId,
            storageExecutionContext,
            logger,
            async ({ executionCluster, executionPath, executionStorage }) =>
              getScowdClient(executionCluster).storageQuota.getUsersStorageQuota({
                userIds: userIdsSlice,
                path: executionPath,
                storage: buildStorageConfigProto(executionStorage),
              }),
          );
          const { userQuotaInfos } = result;

          for (const userQuotaInfo of userQuotaInfos) {
            await em.transactional(async (txEm) => {
              const existingQuota = await txEm.findOne(
                TenantUserStorageQuota,
                {
                  storageId: currentStorageId,
                  user: { userId: userQuotaInfo.userId },
                },
                { lockMode: LockMode.PESSIMISTIC_WRITE },
              );

              if (existingQuota) {
                existingQuota.usage = userQuotaInfo.usedStorageMb;
                txEm.persist(existingQuota);
              } else {
                const user = await txEm.findOne(User, { userId: userQuotaInfo.userId });
                if (!user) {
                  return;
                }

                txEm.persist(
                  new TenantUserStorageQuota({
                    user,
                    ...buildStorageQuotaExecutionFields(
                      currentStorageId,
                      executionCluster,
                      executionPath,
                    ),
                    usage: userQuotaInfo.usedStorageMb,
                  }),
                );
              }

              // 写入 DailyStorageUsage：将当前用量(Mb)转换为GB(保留2位小数)
              const usageGb = Math.round((Number(userQuotaInfo.usedStorageMb) / 1024) * 100) / 100;
              const today = dayjs().tz("Asia/Shanghai").format("YYYY-MM-DD");

              const user = existingQuota
                ? existingQuota.user
                : await txEm.findOne(User, { userId: userQuotaInfo.userId });

              if (user) {
                const existingDaily = await txEm.findOne(DailyStorageUsage, {
                  userId: userQuotaInfo.userId,
                  storageId: currentStorageId,
                  date: today,
                });

                if (existingDaily) {
                  existingDaily.usages.push(usageGb);
                  txEm.persist(existingDaily);
                } else {
                  txEm.persist(new DailyStorageUsage({
                    userId: userQuotaInfo.userId,
                    cluster: executionCluster,
                    storageId: currentStorageId,
                    date: today,
                    usages: [usageGb],
                  }));
                }
              }
            });
          }
        } catch (error) {
          logger.error("Failed to sync storage usage batch", {
            storageId: currentStorageId,
            tenant,
            activatedClusterIds: [...activatedClusterIds],
            userIds: userIdsSlice,
            error,
          });
          userIdsSlice.forEach((currentUserId) => {
            errors.push({
              storageId: currentStorageId,
              userId: currentUserId,
            });
          });
        }
      }
    }

    logger.info("Storage usage sync completed", { errorCount: errors.length, tenant, storageId });

    return errors;
  } catch (error) {
    logger.error("Global error in storage usage synchronization", { storageId, tenant, error });
    throw error;
  }
}
