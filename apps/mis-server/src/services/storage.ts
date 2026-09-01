import { ConnectError } from "@connectrpc/connect";
import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { LockMode, raw } from "@mikro-orm/core";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { libCheckActivatedClusters } from "@scow/lib-server";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { QuotaSortField, StorageServiceServer, StorageServiceService } from "@scow/protos/build/server/storage";
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
      const { tenantName, cluster, path, idOrName, page, pageSize, sortField, sortOrder } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      checkClusterStorageQuotaEnabled(clusterConfigs[cluster], [path]);

      try {
        const scowdClient = getScowdClient(cluster);

        const { totalStorageBytes, usedStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({
          path,
        });

        const tenant = await em.findOne(Tenant, { name: tenantName });
        if (!tenant) {
          logger.error(`Tenant ${tenantName} is not found.`);
          throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} is not found.` } as ServiceError;
        }

        const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: tenant, cluster, path });

        const defaultQuota = tenantQuota?.userDefaultQuota ?? 0;

        // 如果需要排序，则需要先获取所有用户数据进行排序，然后分页
        if (sortField !== undefined) {
          const isAscending = sortOrder !== SortOrder.DESCEND;
          const direction = isAscending ? "ASC" : "DESC";

          // 使用MikroORM QueryBuilder构建复杂查询
          const qb = em.createQueryBuilder(User, "u");

          // LEFT JOIN TenantUserStorageQuota表
          qb.leftJoin("u.storageQuotas", "tusq", {
            "tusq.cluster": cluster,
            "tusq.path": path,
          });

          // 选择需要的字段，使用raw函数处理COALESCE和CASE表达式
          qb.select([
            "u.id",
            "u.userId",
            "u.name",
            raw(`COALESCE(tusq.storage_quota, ${defaultQuota}) as storage_quota`),
            raw("COALESCE(tusq.usage, 0) as used_storage_bytes"),
            raw("CASE WHEN tusq.storage_quota IS NULL THEN 1 ELSE 0 END as use_default"),
          ]);

          // WHERE条件
          qb.where({ tenant });

          // 用户名或ID过滤
          if (idOrName) {
            qb.andWhere({
              $or: [{ userId: { $like: `%${idOrName}%` } }, { name: { $like: `%${idOrName}%` } }],
            });
          }

          // 添加GROUP BY以避免重复记录，包含排序相关的列
          if (sortField === QuotaSortField.USED_STORAGE_BYTES) {
            qb.groupBy([
              "u.id",
              "u.userId",
              "u.name",
              raw("COALESCE(tusq.usage, 0)"),
              raw(`COALESCE(tusq.storage_quota, ${defaultQuota})`),
              raw("CASE WHEN tusq.storage_quota IS NULL THEN 1 ELSE 0 END"),
            ]);
          } else if (sortField === QuotaSortField.STORAGE_QUOTA) {
            qb.groupBy([
              "u.id",
              "u.userId",
              "u.name",
              raw(`COALESCE(tusq.storage_quota, ${defaultQuota})`),
              raw("COALESCE(tusq.usage, 0)"),
              raw("CASE WHEN tusq.storage_quota IS NULL THEN 1 ELSE 0 END"),
            ]);
          } else {
            qb.groupBy([
              "u.id",
              "u.userId",
              "u.name",
              raw(`COALESCE(tusq.storage_quota, ${defaultQuota})`),
              raw("COALESCE(tusq.usage, 0)"),
              raw("CASE WHEN tusq.storage_quota IS NULL THEN 1 ELSE 0 END"),
            ]);
          }

          // 排序逻辑 - 直接使用原始列而不是聚合函数
          const orderByClause: any = {};
          if (sortField === QuotaSortField.USED_STORAGE_BYTES) {
            orderByClause[raw("COALESCE(tusq.usage, 0)")] = direction;
          } else if (sortField === QuotaSortField.STORAGE_QUOTA) {
            orderByClause[raw(`COALESCE(tusq.storage_quota, ${defaultQuota})`)] = direction;
          }
          // 添加二级排序，确保结果稳定
          orderByClause["u.name"] = "ASC";

          qb.orderBy(orderByClause);

          // 分页
          const offset = (page - 1) * (pageSize || DEFAULT_PAGE_SIZE);
          const limit = pageSize || DEFAULT_PAGE_SIZE;
          qb.limit(limit).offset(offset);

          // 执行查询
          const users = await qb.execute();

          // 计算总数 - 使用单独的查询
          const countQb = em.createQueryBuilder(User, "u");
          countQb.where({ tenant });
          if (idOrName) {
            countQb.andWhere({
              $or: [{ userId: { $like: `%${idOrName}%` } }, { name: { $like: `%${idOrName}%` } }],
            });
          }
          const userCount = await countQb.getCount();

          const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({
            userIds: users.map((user) => user.userId || user.user_id),
            path,
          });

          const usersWithQuotaInfo: UserWithQuotaInfo[] = users.map((user: any) => ({
            userId: user.userId || user.user_id,
            name: user.name,
            storageQuota: Number(
              user.storage_quota ||
                userQuotaInfos.find((info) => info.userId === (user.userId || user.user_id))?.blockHardLimitBytes,
            ),
            usedStorageBytes: Number(user.used_storage_bytes),
            useDefault: Boolean(user.use_default),
          }));

          return [
            {
              totalStorageBytes: Number(totalStorageBytes),
              remainingStorageBytes: Number(totalStorageBytes - usedStorageBytes),
              userDefaultQuotaBytes: Number(defaultQuota || totalStorageBytes),
              totalUserCount: userCount,
              usersQuotaInfo: usersWithQuotaInfo.map((user) => ({
                ...user,
                userName: user.name,
                quotaBytes: user.storageQuota,
              })),
            },
          ];
        } else {
          // 不需要排序时，保持原有逻辑
          const [tenantUsers, userCount] = await em.findAndCount(
            User,
            {
              tenant,
              ...(idOrName
                ? {
                    $or: [{ userId: { $like: `%${idOrName}%` } }, { name: { $like: `%${idOrName}%` } }],
                  }
                : {}),
            },
            {
              ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
              fields: ["userId", "name"],
              orderBy: { name: "ASC" },
            },
          );

          const tenantUsersQuota = await em.find(
            TenantUserStorageQuota,
            {
              cluster,
              user: { id: { $in: tenantUsers } },
              path,
            },
            { populate: ["user"] },
          );

          const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({
            userIds: tenantUsers.map((user) => user.userId),
            path,
          });

          const usersWithQuotaInfo: UserWithQuotaInfo[] = tenantUsers.map((user) => {
            const userQuota = tenantUsersQuota.find((q) => q.user.id === user.id);
            const blockHardLimitBytes = userQuotaInfos?.find(
              (info) => info.userId === user.userId,
            )?.blockHardLimitBytes;

            return {
              userId: user.userId,
              name: user.name,
              storageQuota: Number(userQuota?.storageQuota || defaultQuota || blockHardLimitBytes),
              usedStorageBytes: Number(userQuota?.usage || 0),
              useDefault: userQuota?.storageQuota === undefined ? true : false,
            };
          });

          return [
            {
              totalStorageBytes: Number(totalStorageBytes),
              remainingStorageBytes: Number(totalStorageBytes - usedStorageBytes),
              userDefaultQuotaBytes: Number(defaultQuota || totalStorageBytes),
              totalUserCount: userCount,
              usersQuotaInfo: usersWithQuotaInfo.map((user) => ({
                ...user,
                userName: user.name,
                quotaBytes: user.storageQuota,
              })),
            },
          ];
        }
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }
    },

    // 设置租户下用户的配额
    // 如果使用默认值则将当前条目配额改为 undefined
    setTenantUserQuota: async ({ request, em }) => {
      const { cluster, path, userId, tenantName, userQuotaBytes, useTenantDefaultUserQuota } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      checkClusterStorageQuotaEnabled(clusterConfigs[cluster], [path]);

      const scowdClient = getScowdClient(cluster);

      // 开启事务
      await em.transactional(async (em) => {
        try {
          // 文件系统中成功，修改 scow 数据库
          const user = await em.findOne(User, { userId, tenant: { name: tenantName } });
          if (!user) {
            throw {
              code: status.NOT_FOUND,
              message: `User ${userId} is not found in tenant ${tenantName}.`,
            } as ServiceError;
          }

          logger.debug("Querying tenant user quota with PESSIMISTIC_WRITE lock", {
            userId,
            cluster,
            path,
          });

          const userQuota = await em.findOne(
            TenantUserStorageQuota,
            { user, cluster, path },
            {
              lockMode: LockMode.PESSIMISTIC_WRITE,
            },
          );

          logger.debug("Lock acquired", { existingQuota: !!userQuota });

          const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({
            userIds: [userId],
            path,
          });

          // 使用默认值
          if (useTenantDefaultUserQuota) {
            const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: { id: user.tenant.id }, cluster, path });

            // 如果不存在用户配额则创建并设置使用量为实际使用量
            if (!userQuota) {
              const newUserQuota = new TenantUserStorageQuota({
                user,
                cluster,
                path,
                usage: userQuotaInfos[0].usedStorageBytes,
              });
              em.persist(newUserQuota);
            } else {
              userQuota.usage = userQuotaInfos[0].usedStorageBytes;
              userQuota.storageQuota = undefined;
              em.persist(userQuota);
            }

            const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });

            logger.info("Applying default quota to filesystem", {
              defaultQuota: tenantQuota?.userDefaultQuota || totalStorageBytes,
              operation: "setUserStorageQuota",
            });
            await scowdClient.storageQuota.setUserStorageQuota({
              userId,
              path,
              quotaBytes: BigInt(tenantQuota?.userDefaultQuota || 0) || totalStorageBytes,
            });
          } else {
            // 用户配额设置存在时
            if (userQuota && userQuotaBytes) {
              userQuota.storageQuota = BigInt(userQuotaBytes);
              userQuota.usage = userQuotaInfos[0].usedStorageBytes;

              logger.debug("Syncing quota to filesystem");

              await scowdClient.storageQuota.setUserStorageQuota({
                userId,
                path,
                quotaBytes: BigInt(userQuotaBytes),
              });

              em.persist(userQuota);
            } else if (userQuotaBytes) {
              const newTenantUserQuota = new TenantUserStorageQuota({
                user,
                cluster,
                path,
                storageQuota: BigInt(userQuotaBytes),
                usage: userQuotaInfos[0].usedStorageBytes,
              });

              logger.debug("Applying new quota to filesystem");

              await scowdClient.storageQuota.setUserStorageQuota({
                userId,
                path,
                quotaBytes: BigInt(userQuotaBytes),
              });

              em.persist(newTenantUserQuota);
            }
          }
        } catch (err) {
          logger.error(`Failed to set the user ${userId} storage quota under the tenant in scow to ${userQuotaBytes}.`);

          if (err instanceof ConnectError) {
            throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
          }

          throw err;
        }
      });

      return [{}];
    },

    batchSetTenantUsersQuota: async ({ request, em }) => {
      const { cluster, path, userIds, userQuotaBytes, useTenantDefaultUserQuota } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: cluster, activatedClusters: currentActivatedClusters, logger });

      const clusterConfigs = getClusterConfigs(undefined, logger);
      checkClusterStorageQuotaEnabled(clusterConfigs[cluster], [path]);

      const scowdClient = getScowdClient(cluster);

      // 获取用户信息
      const users = await em.find(User, { userId: { $in: userIds } }, { fields: ["userId", "tenant"] });
      const foundUserIds = users.map((u) => u.userId);

      if (foundUserIds.length !== users.length) {
        logger.warn("Some users were not found in the database");
        throw { code: status.NOT_FOUND, message: "Some users are not found." } as ServiceError;
      }

      // 批量获取文件系统配额信息
      const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({
        userIds: foundUserIds,
        path,
      });
      const quotaInfoMap = new Map(userQuotaInfos.map((info) => [info.userId, info]));

      // 收集处理失败的用户ID
      const successUserIds: string[] = [];
      // 开启事务
      await em.transactional(async (em) => {
        try {
          for (const user of users) {
            const userId = user.userId;

            logger.debug("Querying tenant user quota with PESSIMISTIC_WRITE lock", {
              userId,
              cluster,
              path,
            });

            const userQuota = await em.findOne(
              TenantUserStorageQuota,
              { cluster, user, path },
              {
                lockMode: LockMode.PESSIMISTIC_WRITE,
              },
            );

            logger.debug("Lock acquired", { existingQuota: !!userQuota });

            const quotaInfo = quotaInfoMap.get(userId);
            if (!quotaInfo) {
              logger.error(`Quota info for user ${userId} not found, skipping`);
              continue;
            }

            // 使用默认值
            if (useTenantDefaultUserQuota) {
              const tenantQuota = await em.findOne(TenantStorageQuota, {
                tenant: user.tenant,
                cluster,
                path,
              });

              // 如果不存在用户配额则创建并设置使用量为实际使用量
              if (!userQuota) {
                const newUserQuota = new TenantUserStorageQuota({
                  user: em.getReference(User, user.id),
                  cluster,
                  path,
                  usage: quotaInfo.usedStorageBytes,
                });
                em.persist(newUserQuota);
              } else {
                userQuota.usage = quotaInfo.usedStorageBytes;
                userQuota.storageQuota = undefined; // 清除具体配额值，使用默认值
                em.persist(userQuota);
              }

              const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });

              logger.info("Applying default quota to filesystem", {
                userId,
                defaultQuota: tenantQuota?.userDefaultQuota || totalStorageBytes,
                operation: "setUserStorageQuota",
              });

              await scowdClient.storageQuota.setUserStorageQuota({
                userId,
                path,
                quotaBytes: BigInt(tenantQuota?.userDefaultQuota || 0) || totalStorageBytes,
              });
              successUserIds.push(userId);
            } else {
              // 使用指定配额值
              if (!userQuotaBytes) {
                throw new Error("userQuotaBytes is required when useTenantDefaultUserQuota is false");
              }

              if (userQuota) {
                userQuota.storageQuota = BigInt(userQuotaBytes);
                userQuota.usage = quotaInfo.usedStorageBytes;

                logger.debug("Syncing quota to filesystem for user", { userId });

                await scowdClient.storageQuota.setUserStorageQuota({
                  userId,
                  path,
                  quotaBytes: BigInt(userQuotaBytes),
                });

                em.persist(userQuota);
              } else {
                const newTenantUserQuota = new TenantUserStorageQuota({
                  user: em.getReference(User, user.id),
                  cluster,
                  path,
                  storageQuota: BigInt(userQuotaBytes),
                  usage: quotaInfo.usedStorageBytes,
                });

                logger.debug("Applying new quota to filesystem for user", { userId });

                await scowdClient.storageQuota.setUserStorageQuota({
                  userId,
                  path,
                  quotaBytes: BigInt(userQuotaBytes),
                });

                em.persist(newTenantUserQuota);
              }
              successUserIds.push(userId);
            }
          }
        } catch (err) {
          logger.error(`Failed to set storage quota for users ${userIds.join(", ")} under the tenant.`, { error: err });

          if (err instanceof ConnectError) {
            throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
          }

          throw err;
        }
      });

      return [
        {
          failedUserIds: foundUserIds.filter((id) => !successUserIds.includes(id)),
        },
      ];
    },

    // 设置租户下用户的默认存储配额
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
          tenant,
          cluster,
          path,
          userDefaultQuota: BigInt(userQuotaBytes),
        });
        em.persist(newTenantQuota);
      }

      // 在文件系统中设置所有使用默认值的用户的存储配额
      const usersQuotaInfo = await em.find(
        TenantUserStorageQuota,
        {
          cluster,
          user: { tenant: { name: tenantName } },
          path,
          storageQuota: { $ne: null },
        },
        { fields: ["user.id"] },
      );

      const hasQuotaSettingUser = usersQuotaInfo.map((info) => info.user.id);
      const useDefaultQuotaUsers = await em.find(
        User,
        {
          id: { $nin: hasQuotaSettingUser },
          tenant,
        },
        { fields: ["userId"] },
      );

      try {
        const userIds = useDefaultQuotaUsers.map((user) => user.userId);

        const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });
        const { succeededUserIds, failedUserIds } = await scowdClient.storageQuota.setUsersStorageQuota({
          userIds,
          path,
          quotaBytes: BigInt(tenantQuota?.userDefaultQuota || 0) || totalStorageBytes,
        });

        // 如果文件系统中设置失败则会回滚
        await em.flush();

        // 返回成功和失败数量
        return [{ successes: succeededUserIds.length, failures: failedUserIds.length, failedUserIds }];
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

      const user = await em.findOne(User, { userId }, { fields: ["tenant"] });
      if (!user) {
        throw {
          code: status.NOT_FOUND,
          message: `User ${userId} is not found.`,
          details: "USER_NOT_FOUND",
        } as ServiceError;
      }

      const tenantQuotas = await em.find(TenantStorageQuota, {
        tenant: { id: user.tenant.$.id },
        cluster,
        ...(paths.length !== 0 ? { path: { $in: paths } } : {}),
      });

      const userQuotaUsage = await em.find(
        TenantUserStorageQuota,
        {
          cluster,
          user: { userId },
          ...(paths.length !== 0 ? { path: { $in: paths } } : {}),
        },
        { fields: ["path", "storageQuota"] },
      );

      const scowdClient = getScowdClient(cluster);

      try {
        const quotaUsagePromises = currentClusterConfig.storage!.paths.map(async (path) => {
          const quotaUsage = userQuotaUsage.find((usage) => usage.path === path);

          const { userQuotaInfos } = await scowdClient.storageQuota.getUsersStorageQuota({
            userIds: [userId],
            path,
          });

          for (const info of userQuotaInfos) {
            logger.debug(`user ${info.userId} used storage space on is ${info.usedStorageBytes}`);
          }

          const usedStorageBytes = userQuotaInfos[0]?.usedStorageBytes || 0;
          const tenantQuota = tenantQuotas.find((quota) => quota.path === path);

          const { totalStorageBytes } = await scowdClient.storageQuota.getFilesystemStorageUsage({ path });

          if (quotaUsage) {
            return {
              path,
              quotaBytes: Number((quotaUsage.storageQuota ?? tenantQuota?.userDefaultQuota) || totalStorageBytes),
              usedStorageBytes: Number(usedStorageBytes),
            };
          } else {
            return {
              path,
              quotaBytes: Number(tenantQuota?.userDefaultQuota || totalStorageBytes),
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
    getSyncInfo: async ({ request }) => {
      const { cluster, path, tenant } = request;

      return [
        {
          syncStarted: server.ext.syncStorageUsage.started(),
          schedule: server.ext.syncStorageUsage.schedule,
          lastSyncTime: server.ext.syncStorageUsage.lastSync(cluster, path, tenant)?.toISOString() ?? undefined,
        },
      ];
    },

    syncTenantUsersStorageUsage: async ({ request }) => {
      const { cluster, path, tenant } = request;

      const reply = await server.ext.syncStorageUsage.run(cluster, path, tenant);

      return [{ failedUserIds: reply.map((err) => err.userId) }];
    },
  });
});
