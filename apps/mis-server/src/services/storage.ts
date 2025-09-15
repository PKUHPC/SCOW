import { ConnectError } from "@connectrpc/connect";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { LockMode } from "@mikro-orm/core";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { libCheckActivatedClusters } from "@scow/lib-server";
import { StorageServiceServer, StorageServiceService } from "@scow/protos/build/server/storage";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { Tenant } from "src/entities/Tenant";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User } from "src/entities/User";
import { logger } from "src/utils/logger";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";
import { getScowdClient, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { checkClusterStorageQuotaEnabled } from "src/utils/storageQuota";

interface UserWithQuotaInfo {
  userId: string;
  name: string;
  storageQuota: number;
  usedStorageBytes: number;
  useDefault: boolean;
}

export const storageServiceServer = plugin((server) => {

  server.addService<StorageServiceServer>(StorageServiceService, {
    getTenantQuota: async ({ request, em, logger }) => {
      const { tenantName, cluster, path, idOrName, page, pageSize } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      checkClusterStorageQuotaEnabled(clusterConfigs[cluster], [path]);

      try {
        const scowdClient = getScowdClient(cluster);

        const {
          totalStorageBytes, usedStorageBytes,
        } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });

        const tenant = await em.findOne(Tenant, { name: tenantName });
        if (!tenant) {
          logger.error(`Tenant ${tenantName} is not found.`);
          throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
        }

        const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: tenant, cluster, path });

        // 先查询当前租户下的用户 id, 按用户名排序
        const [tenantUsers, userCount] = await em.findAndCount(User, {
          tenant,
          ...idOrName ? {
            $or: [
              { userId: { $like: `%${idOrName}%` } },
              { name: { $like: `%${idOrName}%` } },
            ],
          } : {},
        }, {
          ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
          fields: ["id", "userId", "name"],
          orderBy: { name: "ASC" },
        });

        const tenantUsersQuota = await em.find(TenantUserStorageQuota, {
          cluster, user: { id: { $in: tenantUsers } }, path,
        }, { populate: ["user"]});

        const userIds = tenantUsers.map((user) => user.userId);
        const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({ userIds, path });

        const usersWithQuotaInfo: UserWithQuotaInfo[] = tenantUsers.map((user) => {
          const userStorageQuota = tenantUsersQuota.find((q) => q.user.id === user.id)?.storageQuota;
          const quotaInfo = userQuotaInfos.find((info) => info.userId === user.userId);

          return {
            userId: user.userId,
            name: user.name,
            storageQuota: Number(
              userStorageQuota || tenantQuota?.userDefaultQuota ||
              quotaInfo?.blockHardLimitBytes || totalStorageBytes,
            ),
            usedStorageBytes: Number(quotaInfo?.usedStorageBytes || 0),
            useDefault: userStorageQuota === undefined ? true : false,
          };
        });

        return [{
          totalStorageBytes: Number(totalStorageBytes),
          remainingStorageBytes: Number(totalStorageBytes - usedStorageBytes),
          // 如果userDefaultQuota没有值，则等于总容量
          userDefaultQuotaBytes: Number(tenantQuota?.userDefaultQuota || totalStorageBytes),
          totalUserCount: userCount,
          usersQuotaInfo: usersWithQuotaInfo.map((user) => ({
            ...user,
            userName: user.name,
            quotaBytes: user.storageQuota,
          })),
        }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    setTenantUserQuota: async ({ request, em }) => {
      const { cluster, path, userId, userQuotaBytes, useTenantDefaultUserQuota } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      checkClusterStorageQuotaEnabled(clusterConfigs[cluster], [path]);

      const scowdClient = getScowdClient(cluster);

      // 开启事务
      await em.transactional(async (em) => {
        try {
          // 文件系统中成功，修改 scow 数据库
          const user = await em.findOne(User, { userId });
          if (!user) {
            throw { code: status.NOT_FOUND, message: `User ${userId} is not found.` } as ServiceError;
          }

          logger.debug("Querying tenant user quota with PESSIMISTIC_WRITE lock", {
            userId, cluster, path,
          });

          const userQuota = await em.findOne(TenantUserStorageQuota, { user, cluster, path }, {
            lockMode: LockMode.PESSIMISTIC_WRITE,
          });

          logger.debug("Lock acquired", { existingQuota: !!userQuota });

          // 使用默认值
          if (useTenantDefaultUserQuota) {
            const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: { id: user.tenant.id }, cluster, path });

            // 删除当前条目即可
            if (!userQuota) {
              throw {
                code: status.ALREADY_EXISTS,
                message: `The user ${userId} has used the default storage quota.`,
              } as ServiceError;
            }
            em.remove(userQuota);

            const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });

            logger.info("Applying default quota to filesystem", {
              defaultQuota: tenantQuota?.userDefaultQuota || totalStorageBytes,
              operation: "setUserStorageQuota",
            });
            await scowdClient.storageQuota.setUserStorageQuota({
              userId, path, quotaBytes: BigInt(tenantQuota?.userDefaultQuota || 0) || totalStorageBytes,
            });

          } else {
            if (userQuota && userQuotaBytes) {
              userQuota.storageQuota = BigInt(userQuotaBytes);

              logger.debug("Syncing quota to filesystem");

              await scowdClient.storageQuota.setUserStorageQuota({
                userId, path, quotaBytes: BigInt(userQuotaBytes),
              });

              em.persist(userQuota);
            } else if (userQuotaBytes) {
              const newTenantUserQuota = new TenantUserStorageQuota({
                user, cluster, path, storageQuota: BigInt(userQuotaBytes),
              });

              logger.debug("Applying new quota to filesystem");

              await scowdClient.storageQuota.setUserStorageQuota({
                userId, path, quotaBytes: BigInt(userQuotaBytes),
              });

              em.persist(newTenantUserQuota);
            }
          }
        } catch (err) {
          logger.error(
            `Failed to set the user ${userId} storage quota under the tenant in scow to ${userQuotaBytes}.`,
          );

          if (err instanceof ConnectError) {
            throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
          }

          throw err;
        }
      });

      return [{}];
    },

    setTenantUserDefaultQuota: async ({ request, em }) => {
      const { tenantName, cluster, path, userQuotaBytes } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      checkClusterStorageQuotaEnabled(clusterConfigs[cluster], [path]);

      const scowdClient = getScowdClient(cluster);

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
      }

      // 设置租户下用户的默认配额
      const tenantQuota = await em.findOne(TenantStorageQuota, { tenant, cluster, path });
      if (tenantQuota) {
        tenantQuota.userDefaultQuota = BigInt(userQuotaBytes);
        em.persist(tenantQuota);
      } else {
        const newTenantQuota = new TenantStorageQuota({
          tenant, cluster, path, userDefaultQuota: BigInt(userQuotaBytes) });
        em.persist(newTenantQuota);
      }

      // 在文件系统中设置所有使用默认值的用户的存储配额
      const usersQuotaInfo = await em.find(TenantUserStorageQuota, {
        user: { tenant: { name: tenantName } }, cluster, path,
      });

      const hasQuotaSettingUser = usersQuotaInfo.map((info) => info.user.id);
      const useDefaultQuotaUsers = await em.find(User, {
        id: { $nin: hasQuotaSettingUser }, tenant,
      }, { fields: ["userId"]});

      try {
        const userIds = useDefaultQuotaUsers.map((user) => user.userId);

        const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });
        const { succeededUserIds, failedUserIds } = await scowdClient.storageQuota.setUsersStorageQuota({
          userIds, path, quotaBytes: BigInt(tenantQuota?.userDefaultQuota || 0) || totalStorageBytes,
        });

        // 如果文件系统中设置失败则会回滚
        await em.flush();

        // 返回成功和失败数量
        return [{ successes: succeededUserIds.length, failures: failedUserIds.length }];

      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    getUserStorageUsage: async ({ request, em, logger }) => {
      const { userId, cluster, paths } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      const currentClusterConfig = clusterConfigs[cluster];
      checkClusterStorageQuotaEnabled(currentClusterConfig, paths);

      const user = await em.findOne(User, { userId }, { fields: ["tenant"]});
      if (!user) {
        throw {
          code: status.NOT_FOUND,
          message: `User ${userId} is not found.`,
          details:"USER_NOT_FOUND",
        } as ServiceError;
      }

      const tenantQuotas = await em.find(TenantStorageQuota, {
        tenant: { id: user.tenant.$.id }, cluster,
        ...paths.length !== 0 ? { path: { $in: paths } } : {},
      });

      const userQuotaUsage = await em.find(TenantUserStorageQuota, {
        user: { userId }, cluster,
        ...paths.length !== 0 ? { path: { $in: paths } } : {},
      }, { fields: ["path", "storageQuota"]});

      const scowdClient = getScowdClient(cluster);

      try {
        const quotaUsagePromises = currentClusterConfig.storage!.paths.map(async (path) => {
          const quotaUsage = userQuotaUsage.find((usage) => usage.path === path);

          const { userQuotaInfos } = (await scowdClient.storageQuota.getUsersStorageQuota({
            userIds: [userId], path,
          }));

          for (const info of userQuotaInfos) {
            logger.debug(`user ${info.userId} used storage space on is ${info.usedStorageBytes}`);
          }

          const usedStorageBytes = userQuotaInfos[0]?.usedStorageBytes || 0;

          const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });

          if (quotaUsage) {
            return { path, quotaBytes: Number(quotaUsage.storageQuota), usedStorageBytes: Number(usedStorageBytes) };
          } else {
            return {
              path,
              quotaBytes: Number(
                tenantQuotas?.find((quota) => quota.path === path)?.userDefaultQuota ||
                userQuotaInfos[0]?.blockHardLimitBytes || totalStorageBytes,
              ),
              usedStorageBytes: Number(usedStorageBytes),
            };
          }
        });
        const quotaUsageValues = await Promise.all(quotaUsagePromises);

        return [{ quotaUsage: quotaUsageValues }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }

    },
  });
});
