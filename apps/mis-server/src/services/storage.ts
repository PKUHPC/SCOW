import { ConnectError } from "@connectrpc/connect";
import { Logger, plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { LockMode, raw } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { buildStorageConfigProto, getExecutableStorageIds, getStorageMountRefs } from "@scow/lib-server";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import {
  AccountQuotaInfo as AccountQuotaInfoProto,
  AccountStorageQuotaState,
  QuotaSortField,
  StorageServiceServer,
  StorageServiceService,
} from "@scow/protos/build/server/storage";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { misConfig } from "src/config/mis";
import { createGroupService } from "src/directoryService/groupService";
import { Account, AccountState } from "src/entities/Account";
import { AccountStorageQuota } from "src/entities/AccountStorageQuota";
import { AccountGroupInitStatus, SystemState } from "src/entities/SystemState";
import { Tenant } from "src/entities/Tenant";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User, UserState } from "src/entities/User";
import { UserAccount } from "src/entities/UserAccount";
import { getAccountOwnerMap } from "src/utils/account";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";
import { getScowdClient, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import {
  getScowdQuotaGroupNameForStorage,
  resolveScowdQuotaGroupNames,
  resolveScowdQuotaGroupNamesBestEffort,
} from "src/utils/scowdQuotaGroupName";
import {
  executeStorageOperationWithFailover,
  executeStorageOperationWithFailoverWithContext,
  resolveStorageExecutionTarget,
} from "src/utils/storageExecutionTarget";
import {
  ACCOUNT_QUOTA_STATE,
  changeAllUsersFileGroupToAccountGroup,
  checkAndFixUserGroupsForAccountQuota,
} from "src/utils/storageQuota";
import { buildStorageQuotaExecutionFields } from "src/utils/storageQuotaRecord";

interface UserWithQuotaInfo {
  userId: string;
  name: string;
  storageQuota: number;
  usedStorageMb: number;
  useDefault: boolean;
}

interface TenantQuotaContext {
  tenant: Tenant;
  executionCluster: string;
  executionPath: string;
  executionStorage: ReturnType<typeof getStorageMountRefs>[number];
  mountedClusters: string[];
  totalStorageMbBig: bigint;
  usedStorageMbBig: bigint;
  defaultQuota: bigint;
}

/**
 * 按单用户最终生效配额口径统计租户总配额和总使用量。
 * - tenantAssignedQuotaMb：有单独配额的用户取单独配额，其余用户取默认配额。
 * - tenantUsedStorageMb：对有配额记录的用户求和 usage。
 *   注意：尚未同步/初始化的用户（无 TenantUserStorageQuota 记录）其 usage 无法
 *   从数据库获取，此处按 0 计入。准确性依赖定时同步任务的完整性。
 */
const calculateTenantQuotaStats = (
  userCount: number,
  tenantUserQuotas: Pick<TenantUserStorageQuota, "storageQuota" | "usage">[],
  defaultQuota: bigint,
) => {
  let tenantAssignedQuotaMbBig = BigInt(0);
  let tenantUsedStorageMbBig = BigInt(0);

  for (const quota of tenantUserQuotas) {
    tenantAssignedQuotaMbBig +=
      quota.storageQuota !== null && quota.storageQuota !== undefined ? quota.storageQuota : defaultQuota;
    tenantUsedStorageMbBig += quota.usage;
  }

  // 无配额记录的用户：配额按默认值计入，usage 按 0 计入（依赖同步补齐）
  const usersWithoutQuotaRecord = userCount - tenantUserQuotas.length;
  if (usersWithoutQuotaRecord > 0) {
    tenantAssignedQuotaMbBig += defaultQuota * BigInt(usersWithoutQuotaRecord);
  }

  return { tenantAssignedQuotaMbBig, tenantUsedStorageMbBig };
};

const getTenantQuotaContext = async (
  tenantName: string,
  storageId: string,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
): Promise<TenantQuotaContext> => {
  const {
    executionCluster,
    executionPath,
    executionStorage,
    mountedClusters,
    result: { totalStorageMb, usedStorageMb },
  } = await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
    getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
  );
  const totalStorageMbBig = BigInt(totalStorageMb);
  const usedStorageMbBig = BigInt(usedStorageMb);

  const tenant = await em.findOne(Tenant, { name: tenantName });
  if (!tenant) {
    logger.error(`Tenant ${tenantName} is not found.`);
    throw {
      code: status.NOT_FOUND,
      message: `Tenant ${tenantName} is not found.`,
    } as ServiceError;
  }

  const tenantQuota = await em.findOne(TenantStorageQuota, {
    tenant,
    storageId,
  });

  return {
    tenant,
    executionCluster,
    executionPath,
    executionStorage,
    mountedClusters,
    totalStorageMbBig,
    usedStorageMbBig,
    defaultQuota: tenantQuota?.userDefaultQuota ?? totalStorageMbBig,
  };
};

export const storageServiceServer = plugin((server) => {
  server.addService<StorageServiceServer>(StorageServiceService, {
    getTenantQuotaSummary: async ({ request, em, logger }) => {
      const { tenantName, storageId } = request;
      try {
        const { tenant, mountedClusters, totalStorageMbBig, usedStorageMbBig, defaultQuota } =
          await getTenantQuotaContext(tenantName, storageId, em, logger);

        const userCount = await em.count(User, { tenant });
        const allTenantUsersQuota = await em.find(
          TenantUserStorageQuota,
          {
            storageId,
            user: { tenant },
          },
          { fields: ["storageQuota", "usage"] },
        );
        const { tenantAssignedQuotaMbBig, tenantUsedStorageMbBig } = calculateTenantQuotaStats(
          userCount,
          allTenantUsersQuota,
          defaultQuota,
        );

        return [
          {
            totalStorageMb: Number(totalStorageMbBig),
            remainingStorageMb: Number(totalStorageMbBig - usedStorageMbBig),
            userDefaultQuotaMb: Number(defaultQuota),
            tenantAssignedQuotaMb: Number(tenantAssignedQuotaMbBig),
            tenantUsedStorageMb: Number(tenantUsedStorageMbBig),
            mountedClusters,
          },
        ];
      } catch (err) {
        if (err instanceof ConnectError) {
          logger.error(err);
          throw mapConnectRpcStatusToGrpc(err.code);
        }

        throw err;
      }
    },
    getTenantQuota: async ({ request, em, logger }) => {
      const { tenantName, storageId, idOrName, page, pageSize, sortField, sortOrder } = request;

      try {
        const { tenant, defaultQuota } = await getTenantQuotaContext(tenantName, storageId, em, logger);
        // 如果需要排序，则需要先获取所有用户数据进行排序，然后分页
        if (sortField !== undefined) {
          const isAscending = sortOrder !== SortOrder.DESCEND;
          const direction = isAscending ? "ASC" : "DESC";

          // 使用MikroORM QueryBuilder构建复杂查询
          const qb = em.createQueryBuilder(User, "u");

          // LEFT JOIN TenantUserStorageQuota表
          qb.leftJoin("u.storageQuotas", "tusq", {
            "tusq.storageId": storageId,
          });

          // 选择需要的字段，使用raw函数处理COALESCE和CASE表达式
          qb.select([
            "u.id",
            "u.userId",
            "u.name",
            raw(`COALESCE(tusq.storage_quota, ${defaultQuota}) as storage_quota`),
            raw("COALESCE(tusq.usage, 0) as used_storage_mb"),
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

          // 添加GROUP BY以避免重复记录，包含排序和SELECT中的所有非聚合列
          qb.groupBy([
            "u.id",
            "u.userId",
            "u.name",
            raw(`COALESCE(tusq.storage_quota, ${defaultQuota})`),
            raw("COALESCE(tusq.usage, 0)"),
            raw("CASE WHEN tusq.storage_quota IS NULL THEN 1 ELSE 0 END"),
          ]);

          // 排序逻辑 - 直接使用原始列而不是聚合函数
          const orderByClause: any = {};
          if (sortField === QuotaSortField.USED_STORAGE_MB) {
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

          const { result: { userQuotaInfos } } = await executeStorageOperationWithFailover(
            storageId,
            em,
            logger,
          (target) => getScowdClient(target.executionCluster).storageQuota.getUsersStorageQuota({
              userIds: users.map((user) => user.userId || user.user_id),
              path: target.executionPath,
              storage: buildStorageConfigProto(target.executionStorage),
            }),
            // 批量查询用户配额暂时不进行超时处理，等待后续批量处理整体优化。
            { disableTimeout: true },
          );

          const usersWithQuotaInfo: UserWithQuotaInfo[] = users.map((user: any) => ({
            userId: user.userId || user.user_id,
            name: user.name,
            storageQuota: Number(
              user.storage_quota ??
                userQuotaInfos.find((info) => info.userId === (user.userId || user.user_id))?.blockHardLimitMb ??
                defaultQuota,
            ),
            usedStorageMb: Number(user.used_storage_mb),
            useDefault: Boolean(user.use_default),
          }));

          return [
            {
              totalUserCount: userCount,
              usersQuotaInfo: usersWithQuotaInfo.map((user) => ({
                ...user,
                userName: user.name,
                quotaMb: user.storageQuota,
                usedStorageMb: user.usedStorageMb,
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
              storageId,
              user: { id: { $in: tenantUsers.map((u) => u.id) } },
            },
            { populate: ["user"] },
          );

          const { result: { userQuotaInfos } } = await executeStorageOperationWithFailover(
            storageId,
            em,
            logger,
          (target) => getScowdClient(target.executionCluster).storageQuota.getUsersStorageQuota({
              userIds: tenantUsers.map((user) => user.userId),
              path: target.executionPath,
              storage: buildStorageConfigProto(target.executionStorage),
            }),
            // 批量查询用户配额暂时不进行超时处理，等待后续批量处理整体优化。
            { disableTimeout: true },
          );

          const usersWithQuotaInfo: UserWithQuotaInfo[] = tenantUsers.map((user) => {
            const userQuota = tenantUsersQuota.find((q) => q.user.id === user.id);
            const blockHardLimitMb = userQuotaInfos?.find((info) => info.userId === user.userId)?.blockHardLimitMb;

            return {
              userId: user.userId,
              name: user.name,
              storageQuota: Number(userQuota?.storageQuota ?? blockHardLimitMb ?? defaultQuota),
              usedStorageMb: Number(userQuota?.usage ?? 0),
              useDefault: userQuota?.storageQuota == null,
            };
          });

          return [
            {
              totalUserCount: userCount,
              usersQuotaInfo: usersWithQuotaInfo.map((user) => ({
                ...user,
                userName: user.name,
                quotaMb: user.storageQuota,
                usedStorageMb: user.usedStorageMb,
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
    setTenantUserQuota: async ({ request, em, logger }) => {
      const { storageId, userId, userQuotaMb, useTenantDefaultUserQuota, tenantName } = request;
      const {
        executionCluster,
        executionPath,
        result: { totalStorageMb },
      } = await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
        getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
      );

      logger.info(
        `Setting tenant user storage quota: tenant: ${tenantName}, user: ${userId}, storage: ${storageId}, ` +
          `executionCluster: ${executionCluster}, executionMountPath: ${executionPath}, ` +
          `quotaMb: ${userQuotaMb}, useTenantDefaultUserQuota: ${useTenantDefaultUserQuota}`,
      );

      // 获取文件系统总容量，用于校验和默认配额计算
      // 校验配额范围 (0, totalStorageMb]（仅在设置单独配额时）
      if (!useTenantDefaultUserQuota && userQuotaMb !== undefined && userQuotaMb !== null) {
        if (BigInt(userQuotaMb) <= BigInt(0) || BigInt(userQuotaMb) > BigInt(totalStorageMb)) {
          throw {
            code: status.INVALID_ARGUMENT,
            message: `userQuotaMb must be in (0, ${totalStorageMb}].`,
          } as ServiceError;
        }
      }

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

          const userQuota = await em.findOne(
            TenantUserStorageQuota,
            { user, storageId },
            {
              lockMode: LockMode.PESSIMISTIC_WRITE,
            },
          );

          const { result: { userQuotaInfos } } = await executeStorageOperationWithFailover(
            storageId,
            em,
            logger,
            (target) => getScowdClient(target.executionCluster).storageQuota.getUsersStorageQuota({
              userIds: [userId],
              path: target.executionPath,
              storage: buildStorageConfigProto(target.executionStorage),
            }),
          );
          const usedStorageMb = userQuotaInfos[0]?.usedStorageMb ?? BigInt(0);

          // 使用默认值
          if (useTenantDefaultUserQuota) {
            const tenantQuota = await em.findOne(TenantStorageQuota, {
              tenant: { id: user.tenant.id },
              storageId,
            });

            // 如果不存在用户配额则创建并设置使用量为实际使用量
            if (!userQuota) {
              const newUserQuota = new TenantUserStorageQuota({
                user,
                ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
                usage: usedStorageMb,
              });
              em.persist(newUserQuota);
            } else {
              userQuota.usage = usedStorageMb;
              userQuota.storageQuota = undefined;
              em.persist(userQuota);
            }

            const defaultQuotaMb = tenantQuota?.userDefaultQuota ?? BigInt(totalStorageMb);

            logger.info("Applying default quota to filesystem", {
              storageId,
              userId,
              cluster: executionCluster,
              path: executionPath,
              defaultQuota: defaultQuotaMb,
              operation: "setUserStorageQuota",
            });
            await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
              getScowdClient(target.executionCluster).storageQuota.setUserStorageQuota({
                userId,
                path: target.executionPath,
                quotaMb: defaultQuotaMb,
                storage: buildStorageConfigProto(target.executionStorage),
              }),
            );
          } else {
            // 使用指定配额值
            if (userQuotaMb === undefined || userQuotaMb === null) {
              throw {
                code: status.INVALID_ARGUMENT,
                message: "userQuotaMb is required when useTenantDefaultUserQuota is false.",
              } as ServiceError;
            }

            if (userQuota) {
              // 用户配额记录已存在，更新
              userQuota.storageQuota = BigInt(userQuotaMb);
              userQuota.usage = usedStorageMb;

              logger.debug("Syncing user quota to filesystem", {
                storageId,
                userId,
                cluster: executionCluster,
                path: executionPath,
                quotaMb: userQuotaMb,
              });

              await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
                getScowdClient(target.executionCluster).storageQuota.setUserStorageQuota({
                  userId,
                  path: target.executionPath,
                  quotaMb: BigInt(userQuotaMb),
                  storage: buildStorageConfigProto(target.executionStorage),
                }),
              );

              em.persist(userQuota);
            } else {
              // 用户配额记录不存在，新建
              const newTenantUserQuota = new TenantUserStorageQuota({
                user,
                ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
                storageQuota: BigInt(userQuotaMb),
                usage: usedStorageMb,
              });

              logger.debug("Applying new user quota to filesystem", {
                storageId,
                userId,
                cluster: executionCluster,
                path: executionPath,
                quotaMb: userQuotaMb,
              });

              await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
                getScowdClient(target.executionCluster).storageQuota.setUserStorageQuota({
                  userId,
                  path: target.executionPath,
                  quotaMb: BigInt(userQuotaMb),
                  storage: buildStorageConfigProto(target.executionStorage),
                }),
              );

              em.persist(newTenantUserQuota);
            }
          }
        } catch (err) {
          logger.error(
            `Failed to set the user ${userId} storage quota under the tenant in scow to ${userQuotaMb} MB.`,
            {
              storageId,
              cluster: executionCluster,
              path: executionPath,
              useTenantDefaultUserQuota,
              error: err,
            },
          );

          if (err instanceof ConnectError) {
            throw {
              code: mapConnectRpcStatusToGrpc(err.code),
              details: err.message,
            } as ServiceError;
          }

          throw err;
        }
      });

      return [{}];
    },

    batchSetTenantUsersQuota: async ({ request, em, logger }) => {
      const { storageId, userIds, userQuotaMb, useTenantDefaultUserQuota, tenantName } = request;
      const { executionCluster, executionPath } = await resolveStorageExecutionTarget(storageId, em, logger);

      logger.info(
        `Batch setting tenant users storage quota: tenant: ${tenantName}, userLength: ${userIds.length}, ` +
          `storage: ${storageId}, executionCluster: ${executionCluster}, executionMountPath: ${executionPath}, ` +
          `quotaMb: ${userQuotaMb}, useTenantDefaultUserQuota: ${useTenantDefaultUserQuota}`,
      );

      // 校验配额范围 (0, totalStorageMb]（仅在设置单独配额时）
      if (!useTenantDefaultUserQuota && userQuotaMb !== undefined && userQuotaMb !== null) {
        const { result: { totalStorageMb } } = await executeStorageOperationWithFailover(
          storageId,
          em,
          logger,
          (target) => getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({
            path: target.executionPath,
          }),
        );
        if (BigInt(userQuotaMb) <= BigInt(0) || BigInt(userQuotaMb) > BigInt(totalStorageMb)) {
          throw {
            code: status.INVALID_ARGUMENT,
            message: `userQuotaMb must be in (0, ${totalStorageMb}].`,
          } as ServiceError;
        }
      }

      // 获取用户信息
      const users = await em.find(
        User,
        {
          userId: { $in: userIds },
          ...(tenantName ? { tenant: { name: tenantName } } : {}),
        },
        { fields: ["userId"] },
      );
      const foundUserIds = users.map((u) => u.userId);

      if (foundUserIds.length !== userIds.length) {
        logger.warn("Some users were not found in the database");
        throw { code: status.NOT_FOUND, message: "Some users are not found." } as ServiceError;
      }

      // 批量获取文件系统配额信息
      const { result: { userQuotaInfos } } = await executeStorageOperationWithFailover(
        storageId,
        em,
        logger,
        (target) => getScowdClient(target.executionCluster).storageQuota.getUsersStorageQuota({
          userIds: foundUserIds,
          path: target.executionPath,
          storage: buildStorageConfigProto(target.executionStorage),
        }),
      );
      const quotaInfoMap = new Map<string, { usedStorageMb: bigint }>(
        userQuotaInfos.map((info) => [info.userId, info]),
      );

      // 收集处理失败的用户ID
      const successUserIds: string[] = [];

      // 同一批操作中 tenantQuota 和 totalStorageMb 不会变化，提到循环外只查一次
      const tenantQuota = useTenantDefaultUserQuota
        ? await em.findOne(TenantStorageQuota, {
            tenant: { name: tenantName },
            storageId,
          })
        : null;
      let defaultQuotaMb: bigint | undefined;
      if (useTenantDefaultUserQuota) {
        const { result: { totalStorageMb } } = await executeStorageOperationWithFailover(
          storageId,
          em,
          logger,
          (target) => getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({
            path: target.executionPath,
          }),
        );
        defaultQuotaMb = tenantQuota?.userDefaultQuota ?? BigInt(totalStorageMb);
      }

      // 开启事务
      await em.transactional(async (em) => {
        try {
          for (const user of users) {
            const userId = user.userId;

            const userQuota = await em.findOne(
              TenantUserStorageQuota,
              { storageId, user },
              {
                lockMode: LockMode.PESSIMISTIC_WRITE,
              },
            );

            const quotaInfo = quotaInfoMap.get(userId);
            if (!quotaInfo) {
              logger.error(`Quota info for user ${userId} not found, skipping`);
              continue;
            }

            // 使用默认值
            if (useTenantDefaultUserQuota) {
              const quotaMbForDefault = defaultQuotaMb;
              if (quotaMbForDefault === undefined) {
                throw {
                  code: status.INTERNAL,
                  message: "Failed to determine default quota MB.",
                } as ServiceError;
              }

              // 如果不存在用户配额则创建并设置使用量为实际使用量
              if (!userQuota) {
                const newUserQuota = new TenantUserStorageQuota({
                  user: em.getReference(User, user.id),
                  ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
                  usage: quotaInfo.usedStorageMb,
                });
                em.persist(newUserQuota);
              } else {
                userQuota.usage = quotaInfo.usedStorageMb;
                userQuota.storageQuota = undefined; // 清除具体配额值，使用默认值
                em.persist(userQuota);
              }

              logger.info("Applying default quota to filesystem", {
                storageId,
                userId,
                cluster: executionCluster,
                path: executionPath,
                defaultQuota: quotaMbForDefault,
                operation: "setUserStorageQuota",
              });

              await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
                getScowdClient(target.executionCluster).storageQuota.setUserStorageQuota({
                  userId,
                  path: target.executionPath,
                  quotaMb: quotaMbForDefault,
                  storage: buildStorageConfigProto(target.executionStorage),
                }),
              );
              successUserIds.push(userId);
            } else {
              // 使用指定配额值
              if (userQuotaMb === undefined || userQuotaMb === null) {
                throw {
                  code: status.INVALID_ARGUMENT,
                  message: "userQuotaMb is required when useTenantDefaultUserQuota is false.",
                } as ServiceError;
              }

              if (userQuota) {
                userQuota.storageQuota = BigInt(userQuotaMb);
                userQuota.usage = quotaInfo.usedStorageMb;

                logger.debug("Syncing user quota to filesystem", {
                  storageId,
                  userId,
                  cluster: executionCluster,
                  path: executionPath,
                  quotaMb: userQuotaMb,
                });

                await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
                  getScowdClient(target.executionCluster).storageQuota.setUserStorageQuota({
                    userId,
                    path: target.executionPath,
                    quotaMb: BigInt(userQuotaMb),
                    storage: buildStorageConfigProto(target.executionStorage),
                  }),
                );

                em.persist(userQuota);
              } else {
                const newTenantUserQuota = new TenantUserStorageQuota({
                  user: em.getReference(User, user.id),
                  ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
                  storageQuota: BigInt(userQuotaMb),
                  usage: quotaInfo.usedStorageMb,
                });

                logger.debug("Applying new user quota to filesystem", {
                  storageId,
                  userId,
                  cluster: executionCluster,
                  path: executionPath,
                  quotaMb: userQuotaMb,
                });

                await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
                  getScowdClient(target.executionCluster).storageQuota.setUserStorageQuota({
                    userId,
                    path: target.executionPath,
                    quotaMb: BigInt(userQuotaMb),
                    storage: buildStorageConfigProto(target.executionStorage),
                  }),
                );

                em.persist(newTenantUserQuota);
              }
              successUserIds.push(userId);
            }
          }
        } catch (err) {
          logger.error(`Failed to set storage quota for users ${userIds.join(", ")} under the tenant.`, {
            storageId,
            cluster: executionCluster,
            path: executionPath,
            userQuotaMb,
            useTenantDefaultUserQuota,
            error: err,
          });

          if (err instanceof ConnectError) {
            throw {
              code: mapConnectRpcStatusToGrpc(err.code),
              details: err.message,
            } as ServiceError;
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
    setTenantUserDefaultQuota: async ({ request, em, logger }) => {
      const { tenantName, storageId, userQuotaMb } = request;
      const {
        executionCluster,
        executionPath,
        result: { totalStorageMb },
      } = await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
        getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
      );

      logger.info(
        `Setting tenant user default storage quota: tenant: ${tenantName}, storage: ${storageId}, ` +
          `executionCluster: ${executionCluster}, executionMountPath: ${executionPath}, quotaMb: ${userQuotaMb}`,
      );

      // 校验配额范围 (0, totalStorageMb]
      const userQuotaMbBig = BigInt(userQuotaMb);
      if (userQuotaMbBig <= BigInt(0) || userQuotaMbBig > BigInt(totalStorageMb)) {
        throw {
          code: status.INVALID_ARGUMENT,
          message: `userQuotaMb must be in (0, ${totalStorageMb}].`,
        } as ServiceError;
      }

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        throw {
          code: status.NOT_FOUND,
          message: `Tenant ${tenantName} is not found.`,
        } as ServiceError;
      }

      // 设置租户下用户的默认配额
      let tenantQuota = await em.findOne(TenantStorageQuota, {
        tenant,
        storageId,
      });
      if (tenantQuota) {
        tenantQuota.userDefaultQuota = userQuotaMbBig;
        em.persist(tenantQuota);
      } else {
        tenantQuota = new TenantStorageQuota({
          tenant,
          ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
          userDefaultQuota: userQuotaMbBig,
        });
        em.persist(tenantQuota);
      }

      // 在文件系统中设置所有使用默认值的用户的存储配额
      const usersQuotaInfo = await em.find(
        TenantUserStorageQuota,
        {
          storageId,
          user: { tenant: { name: tenantName } },
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

        // totalStorageMb 已在前面校验配额范围时获取
        const defaultQuotaMb = tenantQuota?.userDefaultQuota ?? BigInt(totalStorageMb);
        logger.info("Applying tenant default quota to users using default value", {
          tenantName,
          storageId,
          cluster: executionCluster,
          path: executionPath,
          userCount: userIds.length,
          defaultQuotaMb: defaultQuotaMb.toString(),
        });
        const { result: { succeededUserIds, failedUserIds } } = await executeStorageOperationWithFailover(
          storageId,
          em,
          logger,
          async (target) => {
            const result = await getScowdClient(target.executionCluster).storageQuota.setUsersStorageQuota({
              userIds,
              path: target.executionPath,
              quotaMb: defaultQuotaMb,
              storage: buildStorageConfigProto(target.executionStorage),
            });
            if (result.succeededUserIds.length === 0) {
              throw {
                code: status.INTERNAL,
                details: "ALL_USERS_FAILED",
                message: `Failed to set storage quota for all ${userIds.length} users on storage ${storageId}`,
              } as ServiceError;
            }
            return result;
          },
          // 批量设置用户配额暂时不进行超时处理，等待后续批量处理整体优化。
          { disableTimeout: true },
        );

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
      const { userId, storageIds } = request;

      // 用户侧接口现在按 storageId 查询；未指定时返回当前所有可执行且开启 quota 的文件系统。
      const clusterConfigs = getClusterConfigs(undefined, logger);
      const currentActivatedClusters = await getActivatedClusters(em, logger).catch((e) => {
        logger.error("Failed to get activated clusters when querying user storage usage.", e);
        return {};
      });
      const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
      const executableStorageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);
      const storageExecutionContext = { clusterConfigs, activatedClusterIds };
      const resolvedStorageIds =
        storageIds.length !== 0
          ? storageIds.filter((currentStorageId) => executableStorageIds.includes(currentStorageId))
          : executableStorageIds;

      if (resolvedStorageIds.length === 0) {
        logger.info(
          { requestedStorageIds: storageIds, activatedClusterIds: [...activatedClusterIds] },
          "No requested quota-enabled storage is available on activated clusters; skipping user quota query",
        );
        return [{ quotaUsage: [] }];
      }

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
        storageId: { $in: resolvedStorageIds },
      });

      const userQuotaUsage = await em.find(
        TenantUserStorageQuota,
        {
          storageId: { $in: resolvedStorageIds },
          user: { userId },
        },
        { fields: ["storageId", "storageQuota"] },
      );

      try {
        // 每个 storageId 只返回一条结果；底层仍会解析到一个可执行挂载点读取实时使用量。
        const quotaUsagePromises = resolvedStorageIds.map(async (currentStorageId) => {
          const quotaUsage = userQuotaUsage.find((usage) => usage.storageId === currentStorageId);
          const { result: { userQuotaInfos, totalStorageMb } } =
            await executeStorageOperationWithFailoverWithContext(
            currentStorageId,
            storageExecutionContext,
            logger,
            async (target) => {
              const scowdClient = getScowdClient(target.executionCluster);
              const [{ userQuotaInfos }, { totalStorageMb }] = await Promise.all([
                scowdClient.storageQuota.getUsersStorageQuota({
                  userIds: [userId],
                  path: target.executionPath,
                  storage: buildStorageConfigProto(target.executionStorage),
                }),
                scowdClient.storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
              ]);
              return { userQuotaInfos, totalStorageMb };
            },
          );
          const usedStorageMb = userQuotaInfos[0]?.usedStorageMb || 0;
          const tenantQuota = tenantQuotas.find((quota) => quota.storageId === currentStorageId);

          return {
            storageId: currentStorageId,
            quotaMb: Number(quotaUsage?.storageQuota ?? tenantQuota?.userDefaultQuota ?? BigInt(totalStorageMb)),
            usedStorageMb: Number(usedStorageMb),
          };
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
    getSyncInfo: async ({ request, em, logger }) => {
      const { storageId, tenant } = request;
      await resolveStorageExecutionTarget(storageId, em, logger);

      return [
        {
          syncStarted: server.ext.syncStorageUsage.started(),
          schedule: server.ext.syncStorageUsage.schedule,
          lastSyncTime: server.ext.syncStorageUsage.lastSync(storageId, tenant)?.toISOString() ?? undefined,
        },
      ];
    },
    getAccountSyncInfo: async ({ request, em, logger }) => {
      const { storageId, tenant } = request;
      await resolveStorageExecutionTarget(storageId, em, logger);

      return [
        {
          syncStarted: server.ext.syncAccountStorageUsage.started(),
          schedule: server.ext.syncAccountStorageUsage.schedule,
          lastSyncTime: server.ext.syncAccountStorageUsage.lastSync(storageId, tenant)?.toISOString() ?? undefined,
        },
      ];
    },

    syncTenantUsersStorageUsage: async ({ request, logger }) => {
      const { storageId, tenant } = request;

      logger.info("Triggering tenant users storage usage sync", {
        storageId,
        tenant,
      });

      const reply = await server.ext.syncStorageUsage.run(storageId, tenant);

      return [{ failedUserIds: reply.map((err) => err.userId) }];
    },
    syncTenantAccountsStorageUsage: async ({ request, logger }) => {
      const { storageId, tenant } = request;

      logger.info("Triggering tenant accounts storage usage sync", {
        storageId,
        tenant,
      });

      const reply = await server.ext.syncAccountStorageUsage.run(storageId, tenant);

      return [{ failedAccountNames: reply.map((err) => err.accountName) }];
    },

    getAccountStorageQuotaState: async ({ em }) => {
      const [stateRecord, confirmedRecord] = await Promise.all([
        em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE }),
        em.findOne(SystemState, { key: SystemState.KEYS.CONFIRMED_ENABLE_ACCOUNT_QUOTA }),
      ]);

      const stateStr = stateRecord?.value ?? ACCOUNT_QUOTA_STATE.DISABLED;
      const confirmed = confirmedRecord?.value === "true";

      let state: AccountStorageQuotaState;
      if (stateStr === ACCOUNT_QUOTA_STATE.ENABLED) {
        state = AccountStorageQuotaState.ENABLED;
      } else if (stateStr === ACCOUNT_QUOTA_STATE.ENABLING) {
        state = AccountStorageQuotaState.ENABLING;
      } else {
        state = AccountStorageQuotaState.DISABLED;
      }

      return [{ state, confirmed }];
    },

    enableAccountStorageQuota: async ({ request, em, logger }) => {
      const { operatorId } = request;
      // 检查用户组功能是否已初始化
      const accountGroupState = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_GROUP_INITIALIZED });
      if (accountGroupState?.value !== AccountGroupInitStatus.INITIALIZED) {
        throw {
          code: status.FAILED_PRECONDITION,
          message: "User group feature is not initialized, cannot enable account storage quota",
          details: "USER_GROUP_NOT_ENABLED",
        } as ServiceError;
      }

      // 检查当前状态
      const stateRecord = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE });
      const currentState = stateRecord?.value ?? ACCOUNT_QUOTA_STATE.DISABLED;

      if (currentState === ACCOUNT_QUOTA_STATE.ENABLED || currentState === ACCOUNT_QUOTA_STATE.ENABLING) {
        throw {
          code: status.FAILED_PRECONDITION,
          message: `Account storage quota is currently ${currentState}, cannot be enabled again`,
          details: "ALREADY_ENABLED_OR_ENABLING",
        } as ServiceError;
      }

      // 检查所有用户是否只属于一个账户
      const userAccountCounts = await em
        .createQueryBuilder(UserAccount, "ua")
        .join("ua.account", "a")
        .join("ua.user", "u")
        .where({ "a.state": { $ne: AccountState.DELETED }, "u.state": { $ne: UserState.DELETED } })
        .select(["ua.user_id as userId", raw("COUNT(ua.account_id) as accountCount")])
        .groupBy("ua.user_id")
        .execute<{ userId: number; accountCount: string }[]>();

      const violatingUserDbIds = userAccountCounts
        .filter((row) => Number(row.accountCount) > 1)
        .map((row) => row.userId);

      if (violatingUserDbIds.length > 0) {
        const violatingUsers = await em.find(User, { id: { $in: violatingUserDbIds } }, { fields: ["userId"] });
        const violatingUserIds = violatingUsers.map((u) => u.userId);
        throw {
          code: status.FAILED_PRECONDITION,
          message: `The following users belong to multiple accounts: ${violatingUserIds.join(",")}`,
          details: `MULTI_ACCOUNT_USERS:${violatingUserIds.join(",")}`,
        } as ServiceError;
      }

      // 检查并修改用户组：
      //  - 恰好 2 个组（同名默认组 + 账户组）：将主组改为账户组并移除同名默认组
      //  - 3 个及以上组：报错
      const groupService = createGroupService(misConfig.directoryService, logger);
      const allUsersForGroupCheck = await em.find(User, { state: { $ne: UserState.DELETED } }, { fields: ["userId"] });
      await checkAndFixUserGroupsForAccountQuota(
        allUsersForGroupCheck.map((user) => user.userId),
        groupService,
        misConfig,
      );

      // 将状态置为 enabling
      if (stateRecord) {
        stateRecord.value = ACCOUNT_QUOTA_STATE.ENABLING;
        em.persist(stateRecord);
      } else {
        em.persist(new SystemState("ACCOUNT_STORAGE_QUOTA_STATE", ACCOUNT_QUOTA_STATE.ENABLING));
      }
      await em.flush();

      // 将平台下所有用户的家目录以及所有存储下的个人目录文件修改为同一个所属组
      try {
        await changeAllUsersFileGroupToAccountGroup(em, operatorId, groupService, logger);
      } catch (err) {
        logger.error("changeAllUsersFileGroupToAccountGroup failed, rolling back state to disabled", { err });
        const rollbackRecord = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE });
        if (rollbackRecord) {
          rollbackRecord.value = ACCOUNT_QUOTA_STATE.DISABLED;
          await em.persistAndFlush(rollbackRecord);
        }

        if (err instanceof ConnectError) {
          throw { code: status.INTERNAL, details: "SCOWD_CALL_FAILED" } as ServiceError;
        }
        throw err;
      }

      return [{}];
    },

    /**
     * 确认开启账户存储配额功能（仅在 ENABLED 状态下可调用）。
     */
    setConfirmedEnableAccountQuota: async ({ request: _request, em }) => {
      const stateRecord = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE });
      const currentState = stateRecord?.value ?? ACCOUNT_QUOTA_STATE.DISABLED;

      if (currentState !== ACCOUNT_QUOTA_STATE.ENABLED) {
        throw {
          code: status.FAILED_PRECONDITION,
          details: "NOT_ENABLED",
        } as ServiceError;
      }

      // 设置已确认标志
      const confirmedRecord = await em.findOne(SystemState, {
        key: SystemState.KEYS.CONFIRMED_ENABLE_ACCOUNT_QUOTA,
      });
      if (confirmedRecord) {
        confirmedRecord.value = "true";
        em.persist(confirmedRecord);
      } else {
        em.persist(new SystemState(SystemState.KEYS.CONFIRMED_ENABLE_ACCOUNT_QUOTA, "true"));
      }
      await em.flush();

      return [{}];
    },

    getAccountStorageUsage: async ({ request, em, logger }) => {
      const { tenantName, accountName, storageIds } = request;

      if (storageIds.length === 0) {
        return [{ quotaUsage: [] }];
      }

      const executionTargets = await Promise.all(
        storageIds.map(async (storageId) => ({
          storageId,
          ...(await resolveStorageExecutionTarget(storageId, em, logger)),
        })),
      );

      const account = await em.findOne(Account, {
        tenant: { name: tenantName },
        accountName,
      });

      if (!account) {
        throw {
          code: status.NOT_FOUND,
          message: `Account ${accountName} is not found in tenant ${tenantName}.`,
          details: "ACCOUNT_NOT_FOUND",
        } as ServiceError;
      }

      const [accountQuotas, tenantQuotas] = await Promise.all([
        em.find(AccountStorageQuota, {
          account: { id: account.id },
          storageId: { $in: storageIds },
        }),
        em.find(TenantStorageQuota, {
          tenant: { name: tenantName },
          storageId: { $in: storageIds },
        }),
      ]);
      const accountQuotaMap = new Map(accountQuotas.map((quota) => [quota.storageId, quota]));
      const tenantQuotaMap = new Map(tenantQuotas.map((quota) => [quota.storageId, quota]));
      try {
        // 保持原有整体查询语义：所有存储并发查询，任一存储失败时整个请求失败，不返回部分存储结果。
        // 如果有nfs、lfs、gpfs, gid解析失败则整个请求失败，不会再单独处理 OceanPacific 存储结果。
        const { groupNameMap } = await resolveScowdQuotaGroupNames(
          [account.accountGroupName!],
          executionTargets.map(({ storageId, executionCluster, executionStorage }) => ({
            ...executionStorage,
            storageId,
            clusterId: executionCluster,
          })),
          logger,
        );
        const quotaUsage = await Promise.all(
          executionTargets.map(async ({ storageId }) => {
            const { result: { groupQuotaInfos, totalStorageMb, scowdAccountGroupName } } =
              await executeStorageOperationWithFailover(storageId, em, logger, async (target) => {
                const scowdClient = getScowdClient(target.executionCluster);
                const scowdAccountGroupName = getScowdQuotaGroupNameForStorage(
                  account.accountGroupName!,
                  target.executionStorage,
                  groupNameMap,
                );
                const [{ groupQuotaInfos }, { totalStorageMb }] = await Promise.all([
                  scowdClient.storageQuota.getGroupsStorageQuota({
                    groupNames: [scowdAccountGroupName],
                    path: target.executionPath,
                    storage: buildStorageConfigProto(target.executionStorage),
                  }),
                  scowdClient.storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
                ]);
                return { groupQuotaInfos, totalStorageMb, scowdAccountGroupName };
              });

            const accountGroupQuotaInfo = (groupQuotaInfos ?? []).find(
              (info) => info.groupName === scowdAccountGroupName,
            );
            const accountQuota = accountQuotaMap.get(storageId);
            const tenantQuota = tenantQuotaMap.get(storageId);
            const quotaMb = accountQuota?.storageQuotaMb ?? tenantQuota?.accountDefaultQuota ?? BigInt(totalStorageMb);

            return {
              storageId,
              quotaMb: Number(quotaMb),
              usedStorageMb: Number(accountGroupQuotaInfo?.usedStorageMb ?? 0),
            };
          }),
        );

        return [{ quotaUsage }];
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }

        throw err;
      }
    },

    getAccountQuota: async ({ request, em, logger }) => {
      const { tenantName, storageId, accountName } = request;

      const { mountedClusters, result: { totalStorageMb, usedStorageMb } } =
        await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
          getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({
            path: target.executionPath,
          }),
        );

      // 查询账户列表
      const accounts = await em.find(
        Account,
        {
          tenant: { name: tenantName },
          ...(accountName ? { accountName: { $like: `%${accountName}%` } } : {}),
        },
        { orderBy: { accountName: "ASC" } },
      );

      // 获取账户存储配额记录
      const accountIds = accounts.map((a) => a.id);
      const quotaRecords = await em.find(
        AccountStorageQuota,
        {
          account: { id: { $in: accountIds } },
          storageId,
        },
        { populate: ["account"] },
      );
      const quotaMap = new Map(quotaRecords.map((r) => [r.account.id, r]));

      // 计算默认配额（优先使用租户配置的账户默认配额，否则使用文件系统总量），单位 MB
      const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: { name: tenantName }, storageId });
      const accountDefaultQuotaMb =
        tenantQuota?.accountDefaultQuota != null ? Number(tenantQuota.accountDefaultQuota) : Number(totalStorageMb);

      // 构建 owner 信息映射
      const accountIdentifiers = accounts.map((acc) => ({
        tenantName: tenantName,
        accountName: acc.accountName,
      }));
      const accountOwnerMap = await getAccountOwnerMap(em, accountIdentifiers);

      // 组装账户配额信息
      const accountsQuotaInfo: AccountQuotaInfoProto[] = accounts.map((acc) => {
        const quotaRecord = quotaMap.get(acc.id);
        const quota = quotaRecord?.storageQuotaMb;
        const useDefault = quota === undefined || quota === null;
        const usedMb = quotaRecord?.usage ?? BigInt(0);
        const key = `${tenantName}-${acc.accountName}`;
        const owner = accountOwnerMap.get(key)?.owner ?? { userId: "", userName: "" };
        const quotaMb = useDefault ? accountDefaultQuotaMb : Number(quota!);
        return {
          accountName: acc.accountName,
          ownerId: owner.userId || "",
          ownerName: owner.userName || "",
          quotaMb,
          usedStorageMb: Number(usedMb),
          useDefault,
        };
      });

      // 计算剩余空间 = 总量 - 已使用
      const remainingStorageMb = Number(totalStorageMb) - Number(usedStorageMb);

      return [
        {
          totalStorageMb: Number(totalStorageMb),
          remainingStorageMb: remainingStorageMb < 0 ? 0 : remainingStorageMb,
          accountDefaultQuotaMb,
          mountedClusters,
          accountsQuotaInfo,
        },
      ];
    },

    batchSetAccountStorageQuota: async ({ request, em, logger }) => {
      const { tenantName, accountNames, storageId, quotaMb, useTenantDefaultAccountQuota } = request;

      if (quotaMb <= 0) {
        throw { code: status.INVALID_ARGUMENT, details: "QUOTA_MUST_BE_POSITIVE" } as ServiceError;
      }

      // 检查账户存储配额功能是否已开启
      const stateRecord = await em.findOne(SystemState, { key: SystemState.KEYS.ACCOUNT_STORAGE_QUOTA_STATE });
      const currentState = stateRecord?.value ?? ACCOUNT_QUOTA_STATE.DISABLED;
      if (currentState !== ACCOUNT_QUOTA_STATE.ENABLED) {
        throw {
          code: status.FAILED_PRECONDITION,
          details: "ACCOUNT_QUOTA_NOT_ENABLED",
        } as ServiceError;
      }

      const {
        executionCluster,
        executionPath,
        executionStorage,
        result: { totalStorageMb },
      } = await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
        getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
      );

      logger.info(
        `Batch setting accounts storage quota: tenant: ${tenantName}, accountsLength: ${accountNames.length}, ` +
          `storage: ${storageId}, executionCluster: ${executionCluster}, executionMountPath: ${executionPath}, ` +
          `quotaMb: ${quotaMb}, useTenantDefaultAccountQuota: ${useTenantDefaultAccountQuota}`,
      );

      // 重置为默认值时，读取当前租户默认配额作为 scowd 的实际配额（单位 MB）
      let effectiveQuotaMb: bigint;
      if (useTenantDefaultAccountQuota) {
        const tenantQuota = await em.findOne(TenantStorageQuota, { tenant: { name: tenantName }, storageId });
        effectiveQuotaMb =
          tenantQuota?.accountDefaultQuota != null ? tenantQuota.accountDefaultQuota : BigInt(totalStorageMb);
      } else {
        if (BigInt(quotaMb) > BigInt(totalStorageMb)) {
          throw { code: status.OUT_OF_RANGE } as ServiceError;
        }
        effectiveQuotaMb = BigInt(quotaMb);
      }

      const accounts = await em.find(Account, {
        accountName: { $in: accountNames },
        tenant: { name: tenantName },
      });

      // 只对为解封用户调用设置账户配额
      // 所以只提前解析未封锁账户的groupName是否有纯数字需要转换为gid
      const failedAccountNames: string[] = [];
      let accountsRequiringScowdUpdate = accounts.filter((account) => !account.blockedInCluster);
      const storageResolutionContext = [{ ...executionStorage, storageId, clusterId: executionCluster }];
      // 单账户修改需要向前端暴露明确的 gid 解析错误；批量修改继续采用原有尽力而为语义。
      const resolution =
        accounts.length === 1
          ? await resolveScowdQuotaGroupNames(
              accountsRequiringScowdUpdate.map((account) => account.accountGroupName!),
              storageResolutionContext,
              logger,
            ).then(({ groupNameMap }) => ({
              items: accountsRequiringScowdUpdate,
              failedItems: [],
              groupNameMap,
            }))
          : await resolveScowdQuotaGroupNamesBestEffort(
              accountsRequiringScowdUpdate,
              (account) => account.accountGroupName!,
              storageResolutionContext,
              logger,
            );
      accountsRequiringScowdUpdate = resolution.items;
      const { groupNameMap } = resolution;
      failedAccountNames.push(...resolution.failedItems.map((account) => account.accountName));
      const accountsRequiringScowdUpdateIds = new Set(accountsRequiringScowdUpdate.map((account) => account.id));
      // 重置为默认时存 null，否则存实际配额（DB 以 MB 存储）
      const savedQuotaMb = useTenantDefaultAccountQuota ? null : effectiveQuotaMb;

      for (const account of accounts) {
        if (!account.blockedInCluster && !accountsRequiringScowdUpdateIds.has(account.id)) {
          continue;
        }
        try {
          await em.transactional(async (em) => {
            const existing = await em.findOne(
              AccountStorageQuota,
              { account, storageId },
              {
                lockMode: LockMode.PESSIMISTIC_WRITE,
              },
            );
            if (existing) {
              existing.storageQuotaMb = savedQuotaMb;
              em.persist(existing);
            } else if (savedQuotaMb !== null) {
              // 只在有具体配额时才建记录；null 表示跟随默认，不需要记录
              em.persist(new AccountStorageQuota({ account, storageId, storageQuotaMb: savedQuotaMb }));
            }

            if (account.blockedInCluster) {
              logger.debug(
                "Account %s is blocked in cluster, skipping setting group storage quota in scowd.",
                account.accountName,
              );
              return;
            }

            await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
              getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
                groupName: getScowdQuotaGroupNameForStorage(
                  account.accountGroupName!, target.executionStorage, groupNameMap,
                ),
                path: target.executionPath,
                quotaMb: totalStorageMb > 0 ? effectiveQuotaMb : BigInt(0),
                storage: buildStorageConfigProto(target.executionStorage),
              }),
            );
          });
        } catch (err) {
          logger.error(`Failed to set storage quota for account ${account.accountName}`, { err });
          failedAccountNames.push(account.accountName);
        }
      }

      return [{ failedAccountNames }];
    },

    setAccountDefaultStorageQuota: async ({ request, em, logger }) => {
      const { tenantName, storageId, quotaMb } = request;

      const {
        executionCluster,
        executionPath,
        executionStorage,
        result: { totalStorageMb },
      } = await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
        getScowdClient(target.executionCluster).storageQuota.getFilesystemStorageUsage({ path: target.executionPath }),
      );

      logger.info(
        `Setting account default storage quota: tenant: ${tenantName}, storage: ${storageId}, ` +
          `executionCluster: ${executionCluster}, executionMountPath: ${executionPath}, ` +
          `quotaMb: ${quotaMb}`,
      );

      if (BigInt(quotaMb) <= BigInt(0) || BigInt(quotaMb) > BigInt(totalStorageMb)) {
        throw { code: status.INVALID_ARGUMENT } as ServiceError;
      }

      const tenant = await em.findOne(Tenant, { name: tenantName });
      if (!tenant) {
        throw { code: status.NOT_FOUND, message: `Tenant ${tenantName} not found.` } as ServiceError;
      }

      // 对没有单独设置配额的账户（storageQuota 为 null）批量应用新默认值
      const accountsWithoutQuota = await em.find(Account, { tenant });
      const accountsWithQuota = await em.find(
        AccountStorageQuota,
        {
          account: { tenant },
          storageId,
          storageQuotaMb: { $ne: null },
        },
        { fields: ["account.id"] },
      );
      const accountIdsWithQuota = new Set(accountsWithQuota.map((q) => q.account.id));
      let accountsUsingDefault = accountsWithoutQuota.filter((a) => !accountIdsWithQuota.has(a.id));
      const failedAccountNames: string[] = [];
      const resolution = await resolveScowdQuotaGroupNamesBestEffort(
        accountsUsingDefault,
        (account) => account.accountGroupName!,
        [{ ...executionStorage, storageId, clusterId: executionCluster }],
        logger,
      );
      accountsUsingDefault = resolution.items;
      const { groupNameMap } = resolution;
      failedAccountNames.push(...resolution.failedItems.map((account) => account.accountName));

      // 全部账户组名预处理成功后再修改 ORM entity，避免预处理失败时留下待提交的默认配额变更。
      let tenantQuota = await em.findOne(TenantStorageQuota, { tenant, storageId });
      if (tenantQuota) {
        tenantQuota.accountDefaultQuota = BigInt(quotaMb);
        em.persist(tenantQuota);
      } else {
        tenantQuota = new TenantStorageQuota({
          tenant,
          ...buildStorageQuotaExecutionFields(storageId, executionCluster, executionPath),
          userDefaultQuota: BigInt(totalStorageMb),
        });
        tenantQuota.accountDefaultQuota = BigInt(quotaMb);
        em.persist(tenantQuota);
      }

      let successes = 0;

      try {
        for (const account of accountsUsingDefault) {
          try {
            await executeStorageOperationWithFailover(storageId, em, logger, (target) =>
              getScowdClient(target.executionCluster).storageQuota.setGroupStorageQuota({
                groupName: getScowdQuotaGroupNameForStorage(
                  account.accountGroupName!, target.executionStorage, groupNameMap,
                ),
                path: target.executionPath,
                quotaMb: BigInt(quotaMb),
                storage: buildStorageConfigProto(target.executionStorage),
              }),
            );
            successes++;
          } catch (err) {
            logger.error(`Failed to apply default quota to account ${account.accountName}`, { err });
            failedAccountNames.push(account.accountName);
          }
        }

        await em.flush();
      } catch (err) {
        if (err instanceof ConnectError) {
          throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
        }
        throw err;
      }

      return [{ successes, failures: failedAccountNames.length, failedAccountNames }];
    },
  });
});
