import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { raw, UniqueConstraintViolationException } from "@mikro-orm/core";
import { getI18nSeverTypeFormat, libCheckActivatedClusters, libCheckAppIdInClusterApps } from "@scow/lib-server";
import {
  AppAuthorizationInfo,
  AppAuthorizationServiceServer,
  AppAuthorizationServiceService,
  AppScope,
  GetTargetAppAuthorizationsRequest_TargetType,
  GetTenantAppsResponse_TenantApp,
  UpdateDefaultAppRequest_UpdateAction,
} from "@scow/protos/build/server/app_authorization";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { configClusters } from "src/config/clusters";
import { Account, AccountState } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { AppScope as EntityAppScope } from "src/entities/AppScope";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import { User, UserState } from "src/entities/User";
import { UserAccount, UserRole, UserStatus } from "src/entities/UserAccount";
import { getAiClusterAppConfigs, getClusterAppConfigs } from "src/utils/app";
import {
  addToTenantDefaultApps,
  authorizeAccountApp,
  authorizeTenantApp,
  formatTargetAppInfoList,
  removeFromTenantDefaultApps,
} from "src/utils/appAuthorization";
import { logger } from "src/utils/logger";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";

const formatAppScope = (appScope: AppScope | undefined) => {
  if (appScope === undefined) return "undefined";
  return `${AppScope[appScope] ?? "UNKNOWN"} (${appScope})`;
};

// 显式传入的 appScope 优先；旧调用方未传时，仅在集群只启用一个平台的情况下从配置推断。
const parseAppScope = (clusterId: string, appScope: AppScope | undefined): EntityAppScope => {
  if (appScope === AppScope.HPC) return EntityAppScope.HPC;
  if (appScope === AppScope.AI) return EntityAppScope.AI;

  if (appScope !== undefined && appScope !== AppScope.APP_SCOPE_UNSPECIFIED) {
    const details =
      `Invalid appScope "${formatAppScope(appScope)}" for cluster "${clusterId}". ` +
      `Expected HPC (${AppScope.HPC}) or AI (${AppScope.AI}).`;
    throw new ServiceError({ code: Status.INVALID_ARGUMENT, message: details, details });
  }

  const clusterConfig = configClusters[clusterId];
  if (!clusterConfig) {
    const details = `Cluster configuration for "${clusterId}" was not found while resolving appScope.`;
    throw new ServiceError({ code: Status.NOT_FOUND, message: details, details });
  }

  const hpcEnabled = clusterConfig.hpc.enabled;
  const aiEnabled = clusterConfig.ai.enabled;
  if (hpcEnabled && !aiEnabled) return EntityAppScope.HPC;
  if (aiEnabled && !hpcEnabled) return EntityAppScope.AI;

  if (hpcEnabled && aiEnabled) {
    const details =
      `appScope is required for cluster "${clusterId}" because both HPC and AI applications are enabled. ` +
      "The caller must specify HPC or AI.";
    throw new ServiceError({ code: Status.INVALID_ARGUMENT, message: details, details });
  }

  const details =
    `appScope cannot be inferred for cluster "${clusterId}" because neither HPC nor AI applications are enabled. ` +
    "The caller must specify an enabled application scope.";
  throw new ServiceError({ code: Status.INVALID_ARGUMENT, message: details, details });
};

const resolveClusterApps = (clusterId: string, appScope: AppScope | undefined) => {
  const parsedScope = parseAppScope(clusterId, appScope);
  const clusterConfig = configClusters[clusterId];
  const scopeConfig = parsedScope === EntityAppScope.AI ? clusterConfig.ai : clusterConfig.hpc;
  if (!scopeConfig.enabled) {
    const details = `${parsedScope} applications are not enabled in cluster "${clusterId}".`;
    throw new ServiceError({ code: Status.INVALID_ARGUMENT, message: details, details });
  }

  logger.trace(
    "Resolving apps in cluster %s with appScope %s, using %s app configs.",
    clusterId,
    parsedScope,
    parsedScope,
  );

  return parsedScope === EntityAppScope.AI ? getAiClusterAppConfigs(clusterId) : getClusterAppConfigs(clusterId);
};

export const appAuthorizationServiceServer = plugin((server) => {
  server.addService<AppAuthorizationServiceServer>(AppAuthorizationServiceService, {
    getTargetAppAuthorizations: async ({ request, em }) => {
      const { pageSize, page, clusterId, targetType, tenantName, filterTargetName, filterAccountOwnerIdOrName } =
        request;
      const appScope = parseAppScope(clusterId, request.appScope);
      if (targetType === GetTargetAppAuthorizationsRequest_TargetType.UNKNOWN) {
        const details =
          `Invalid targetType "${GetTargetAppAuthorizationsRequest_TargetType[targetType]}" (${targetType}). ` +
          "Expected TENANT or ACCOUNT.";
        throw new ServiceError({
          code: Status.INVALID_ARGUMENT,
          message: details,
          details,
        });
      }

      // 检查集群是否为在线集群
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });
      const clusterSearchParam = { cluster: { clusterId: clusterId } };

      // 获得集群下交互式应用列表
      const clusterConfigAppInfos: Record<string, AppAuthorizationInfo[]> = {};
      const clusterAppIds: Record<string, string[]> = {};
      const clusterApps = resolveClusterApps(clusterId, request.appScope);
      clusterAppIds[clusterId] = Object.keys(clusterApps);
      clusterConfigAppInfos[clusterId] = Object.keys(clusterApps).map((x) => {
        return {
          appId: x,
          appName: clusterApps[x].name,
          isDisabled: false,
        };
      });
      logger.trace("Current cluster apps list: %o", clusterConfigAppInfos);

      // ************************查询租户对象的交互式应用列表**********************************
      if (targetType === GetTargetAppAuthorizationsRequest_TargetType.TENANT) {
        logger.trace("Start query tenants' app lists");
        const [tenants, count] = await em.findAndCount(
          Tenant,
          filterTargetName ? { name: { $like: `%${filterTargetName}%` } } : {},
          { ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE) },
        );

        const tenantNames = tenants.map((t) => t.name);
        const tenantsBlacklist = await em.find(
          TenantAppBlacklist,
          {
            ...clusterSearchParam,
            tenant: { name: { $in: tenantNames } },
            appScope,
          },
          {
            populate: ["cluster", "tenant"],
          },
        );
        logger.trace("Current tenants' blacklist: %s", tenantsBlacklist.map((t) => t.appId).join(", "));

        const formatResult = formatTargetAppInfoList(
          logger,
          clusterId,
          tenantNames,
          tenantsBlacklist,
          clusterConfigAppInfos,
          clusterAppIds,
          targetType,
          count,
        );
        return [formatResult];

        // ************************查询账户对象的交互式应用列表**********************************
      } else {
        interface RawAccountWithOwner {
          accountName: string;
          tenantName: string;
          accountOwnerId: string | undefined;
          accountOwnerName: string | undefined;
        }

        const qb = em.createQueryBuilder(Account, "a");
        qb.leftJoin("a.tenant", "t")
          .leftJoin("a.users", "ua", { "ua.role": UserRole.OWNER })
          .leftJoin("ua.user", "u")
          .select([
            "a.account_name as accountName",
            raw("t.name as tenantName"),
            raw("u.user_id as accountOwnerId"),
            raw("u.name as accountOwnerName"),
          ])
          .where({
            "t.name": tenantName,
            "a.state": { $ne: AccountState.DELETED },
          });

        // filter 条件变更为 二选一不再支持聚合搜索后的 兜底处理
        // 该判断正常不会触发，只是在代码层面避免同时传参时静默忽略其中一个参数。
        if (filterTargetName && filterAccountOwnerIdOrName) {
          const details =
            "Only one account search filter can be used at a time: filterTargetName or " +
            "filterAccountOwnerIdOrName.";
          throw new ServiceError({
            code: Status.INVALID_ARGUMENT,
            message: details,
            details,
          });
        }

        if (filterTargetName) {
          qb.andWhere({
            "a.account_name": { $like: `%${filterTargetName}%` },
          });
        } else if (filterAccountOwnerIdOrName) {
          qb.andWhere({
            $or: [
              { "u.user_id": { $like: `%${filterAccountOwnerIdOrName}%` } },
              { "u.name": { $like: `%${filterAccountOwnerIdOrName}%` } },
            ],
          });
        }

        // 克隆queryBuilder，查出总数量，防止后面分页查询的queryBuilder被锁定
        const count = await qb.clone().count();

        // 执行查询
        const accountsRaw = await qb
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .execute<RawAccountWithOwner[]>();

        if (accountsRaw.length === 0) {
          return [{ appLists: [], totalCount: 0 }];
        }
        const associatedTenant = accountsRaw[0].tenantName;
        const accountNames = accountsRaw.map((a) => a.accountName);
        const accountOwnerMap = new Map<string, { ownerId?: string; ownerName?: string }>();
        accountsRaw.forEach((r) => {
          accountOwnerMap.set(r.accountName, {
            ownerId: r.accountOwnerId || undefined,
            ownerName: r.accountOwnerName || undefined,
          });
        });

        const [accountBlacklist, associatedTenantBlacklist] = await Promise.all([
          em.find(
            AccountAppBlacklist,
            {
              ...clusterSearchParam,
              account: { accountName: { $in: accountNames } },
              appScope,
            },
            { populate: ["cluster", "account"] },
          ),
          em.find(
            TenantAppBlacklist,
            {
              ...clusterSearchParam,
              tenant: { name: associatedTenant },
              appScope,
            },
            { populate: ["cluster", "tenant"] },
          ),
        ]);

        const formatResult = formatTargetAppInfoList(
          logger,
          clusterId,
          accountNames,
          accountBlacklist,
          clusterConfigAppInfos,
          clusterAppIds,
          targetType,
          count,
          associatedTenantBlacklist,
          accountOwnerMap,
        );
        return [formatResult];
      }
    },

    authorizeApp: async ({ request, em }) => {
      const { clusterId, appId, operatorId, action, target } = request;
      const appScope = parseAppScope(clusterId, request.appScope);

      if (!target) {
        const details =
          `Authorization target is required for app "${appId}" with appScope "${appScope}" ` +
          `in cluster "${clusterId}". Expected tenantName or accountName.`;
        throw new ServiceError({
          code: Status.INVALID_ARGUMENT,
          message: details,
          details,
        });
      }

      return await em
        .transactional(async (em) => {
          const [foundCluster, foundOperator] = await Promise.all([
            em.findOne(Cluster, { clusterId: clusterId }),
            em.findOne(User, { userId: operatorId }),
          ]);
          // 验证clusterId是否在当前在线集群中
          if (!foundCluster) {
            const details = `Cluster ${clusterId} is not found.`;
            throw new ServiceError({
              code: Status.NOT_FOUND,
              message: details,
              details,
            });
          }
          const currentActivatedClusters = await getActivatedClusters(em, logger);
          libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

          // 验证user存在
          if (!foundOperator || foundOperator.state === UserState.DELETED) {
            const details = `Operator ${operatorId} is not found or deleted.`;
            throw new ServiceError({
              code: Status.NOT_FOUND,
              message: details,
              details,
            });
          }

          const clusterApps = resolveClusterApps(clusterId, request.appScope);

          libCheckAppIdInClusterApps({ appId, appIds: Object.keys(clusterApps), clusterId, logger });

          if (target.$case === "accountName") {
            await authorizeAccountApp(
              em,
              target.accountName,
              clusterId,
              appId,
              appScope,
              action,
              foundCluster,
              foundOperator,
              logger,
            );
            // ************************************对租户执行授权/取消授权APP操作************************************************
          } else {
            await authorizeTenantApp(
              em,
              target.tenantName,
              clusterId,
              appId,
              appScope,
              action,
              foundCluster,
              foundOperator,
              logger,
            );
          }

          return [{ executed: true }] as [{ executed: boolean }];
        })
        .catch((error) => {
          if (error instanceof UniqueConstraintViolationException) {
            logger.info("App authorization was already updated by a concurrent request");
            return [{ executed: true }] as [{ executed: boolean }];
          }
          throw error;
        });
    },

    getUserAvailableClusterApps: async ({ request, em }) => {
      const { clusterId, userId } = request;
      const appScope = parseAppScope(clusterId, request.appScope);

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      return await em.transactional(async (em) => {
        const foundUser = await em.findOne(User, { userId: userId });
        if (!foundUser || foundUser.state === UserState.DELETED) {
          const details = `User "${userId}" is not found or has been deleted.`;
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: details,
            details,
          });
        }

        const clusterApps = resolveClusterApps(clusterId, request.appScope);

        const currentClusterAppIds = Object.keys(clusterApps);
        if (currentClusterAppIds.length === 0) {
          const details =
            `No applications are available for cluster "${clusterId}" with appScope "${appScope}". ` +
            "Please check the cluster application configuration.";
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: details,
            details,
          });
        }

        // 查询当前用户关联的未删除的账户列表
        const qb = em.createQueryBuilder(UserAccount, "ua");
        const accounts: { accountName: string; accountsBlockedInCluster: boolean; blockedInCluster: UserStatus }[] =
          await qb
            .join("ua.user", "u")
            .join("ua.account", "a")
            .select([
              "a.account_name AS accountName",
              "a.blocked_in_cluster AS accountsBlockedInCluster",
              "ua.blockedInCluster",
            ])
            .where({ "u.userId": userId })
            .andWhere({ "a.state": { $ne: AccountState.DELETED } })
            .execute();

        const accountNames = accounts.map((a) => a.accountName);

        const accountsBlacklist = await em.find(
          AccountAppBlacklist,
          {
            cluster: { clusterId: clusterId },
            appScope,
            account: {
              accountName: { $in: accountNames },
            },
          },
          {
            populate: ["cluster", "account"],
          },
        );

        // 创建 { accountName: appId[] } 的映射
        const accountBlackAppsMap = new Map<string, Set<string>>();
        accountsBlacklist.forEach((item) => {
          const accountName = item.account.getProperty("accountName");
          if (!accountBlackAppsMap.has(accountName)) {
            accountBlackAppsMap.set(accountName, new Set());
          }
          accountBlackAppsMap.get(accountName)!.add(item.appId);
        });

        // 当用户所有关联账户都被禁用此APP时，则从可用应用列表中移除
        const availableApps = currentClusterAppIds
          .filter((appId) => {
            // 如果没有账户，直接返回true
            if (accountNames.length === 0) return true;
            return !accountNames.every((accountName) => accountBlackAppsMap.get(accountName)?.has(appId) || false);
          })
          .map((id) => {
            const appConfig = clusterApps[id];
            const imageConfig = (appConfig as { image?: { name: string; tag?: string } }).image;
            const webStartCommand = (appConfig.web as { startCommand?: string } | undefined)?.startCommand;

            const availableAccounts = accounts.filter(
              (account) =>
                !accountBlackAppsMap.get(account.accountName)?.has(id) &&
                !account.accountsBlockedInCluster &&
                account.blockedInCluster !== UserStatus.BLOCKED,
            );

            const allAuthorizedAccounts = accounts.filter(
              (account) => !accountBlackAppsMap.get(account.accountName)?.has(id),
            );

            return {
              id,
              name: appConfig.name,
              logoPath: appConfig.logoPath,
              comment: appConfig.appComment ? getI18nSeverTypeFormat(appConfig.appComment) : undefined,
              image: imageConfig ? `${imageConfig.name}:${imageConfig.tag ?? "latest"}` : undefined,
              startCommand: webStartCommand ?? appConfig.vnc?.xstartup,
              availableAccounts: availableAccounts.map((a) => a.accountName),
              allAuthorizedAccounts: allAuthorizedAccounts.map((a) => a.accountName),
            };
          });

        logger.trace("Available apps: %o for user: %s in cluster: %s", availableApps, userId, clusterId);

        return [{ apps: availableApps }];
      });
    },

    getAppForbiddenAccounts: async ({ request, em }) => {
      const { clusterId, appId } = request;
      const appScope = parseAppScope(clusterId, request.appScope);

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      const clusterApps = resolveClusterApps(clusterId, request.appScope);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        const details =
          `No applications are available for cluster "${clusterId}" with appScope "${appScope}". ` +
          "Please check the cluster application configuration.";
        throw new ServiceError({
          code: Status.NOT_FOUND,
          message: details,
          details,
        });
      }
      libCheckAppIdInClusterApps({ appId, appIds: currentClusterAppIds, clusterId, logger });

      const qb = em.createQueryBuilder(AccountAppBlacklist, "aab");
      const accounts: { accountName: string }[] = await qb
        .join("aab.cluster", "c")
        .join("aab.account", "a")
        .select(raw("a.account_name AS accountName"))
        .where({ "aab.appId": appId })
        .andWhere({ "aab.appScope": appScope })
        .andWhere({ "c.clusterId": clusterId })
        .andWhere({ "a.state": { $ne: AccountState.DELETED } })
        .execute();

      const accountNames = accounts.map((a) => a.accountName);
      logger.trace("Forbidden accounts: %s for appId: %s in cluster: %s", accountNames.join(","), appId, clusterId);

      return [{ accountNames }];
    },

    checkAppIsDisabled: async ({ request, em }) => {
      const { clusterId, appId, accountName } = request;
      const appScope = parseAppScope(clusterId, request.appScope);

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      const clusterApps = resolveClusterApps(clusterId, request.appScope);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        const details =
          `No applications are available for cluster "${clusterId}" with appScope "${appScope}". ` +
          "Please check the cluster application configuration.";
        throw new ServiceError({
          code: Status.NOT_FOUND,
          message: details,
          details,
        });
      }
      libCheckAppIdInClusterApps({ appId, appIds: currentClusterAppIds, clusterId, logger });
      const found = await em.findOne(
        AccountAppBlacklist,
        {
          cluster: { clusterId: clusterId },
          appId: appId,
          appScope,
          account: { accountName: accountName },
        },
        {
          populate: ["cluster", "account"],
        },
      );

      return [{ isDisabled: !!found }];
    },

    getTenantApps: async ({ request, em }) => {
      const { clusterId, tenantName } = request;
      const appScope = parseAppScope(clusterId, request.appScope);
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      const clusterApps = resolveClusterApps(clusterId, request.appScope);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        // 该集群下没有可以使用的交互式应用
        return [{ tenantApps: [] }];
      }

      return await em.transactional(async (em) => {
        const [tenantBlackApps, tenantDefaultRemovedApps] = await Promise.all([
          em.find(
            TenantAppBlacklist,
            {
              cluster: { clusterId },
              tenant: { name: tenantName },
              appScope,
            },
            { populate: ["tenant", "cluster"] },
          ),

          em.find(
            TenantDefaultAppRemovedList,
            {
              cluster: { clusterId },
              tenant: { name: tenantName },
              appScope,
            },
            { populate: ["tenant", "cluster"] },
          ),
        ]);

        // 提取ID集合
        const blackAppIds = new Set(tenantBlackApps.map((app) => app.appId));
        const removedAppIds = new Set(tenantDefaultRemovedApps.map((app) => app.appId));

        // 获取租户已授权应用，默认授权应用
        const tenantApps: GetTenantAppsResponse_TenantApp[] = currentClusterAppIds
          .filter((id) => !blackAppIds.has(id))
          .map((appId) => ({
            id: appId,
            name: clusterApps[appId].name,
            logoPath: clusterApps[appId].logoPath,
            isDefault: !removedAppIds.has(appId),
          }));

        return [{ tenantApps }];
      });
    },

    updateDefaultApp: async ({ request, em }) => {
      const { clusterId, tenantName, appId, updateAction, operatorId } = request;
      const appScope = parseAppScope(clusterId, request.appScope);

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      const clusterApps = resolveClusterApps(clusterId, request.appScope);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        // 该集群下没有可以使用的交互式应用
        logger.info("There is no app configs in the cluster: %s", clusterId);
      }

      const appIsNotInConfig = !currentClusterAppIds.includes(appId);

      return await em
        .transactional(async (em) => {
          const [
            foundTenant,
            foundCluster,
            foundOperator,
            // 查询要更新的 租户及APP 是否在 TenantDefaultAppRemovedList 中
            foundRemovedApp,
            // 查询租户已经被禁用的 APP 列表
            tenantBlackApps,
          ] = await Promise.all([
            em.findOne(Tenant, { name: tenantName }),
            em.findOne(Cluster, { clusterId: clusterId }),
            em.findOne(User, { userId: operatorId }),
            em.findOne(
              TenantDefaultAppRemovedList,
              {
                cluster: { clusterId: clusterId },
                tenant: { name: tenantName },
                appId: appId,
                appScope,
              },
              { populate: ["cluster", "tenant"] },
            ),
            em.find(
              TenantAppBlacklist,
              {
                cluster: { clusterId: clusterId },
                tenant: { name: tenantName },
                appScope,
              },
              { populate: ["tenant", "cluster"] },
            ),
          ]);

          if (!foundTenant) {
            const details = `Tenant ${tenantName} is not found.`;
            throw new ServiceError({
              code: Status.NOT_FOUND,
              message: details,
              details,
            });
          }
          if (!foundCluster) {
            const details = `Cluster ${clusterId} is not found.`;
            throw new ServiceError({
              code: Status.NOT_FOUND,
              message: details,
              details,
            });
          }
          if (!foundOperator) {
            const details = `Operator ${operatorId} is not found.`;
            throw new ServiceError({
              code: Status.NOT_FOUND,
              message: details,
              details,
            });
          }

          const appIsInTenantBlacklist = tenantBlackApps.map((app) => app.appId)?.includes(appId);
          // appId 不在config配置文件中
          // 或者 在租户禁用app列表中
          // 添加或移除均认为失败，不去更新租户下账户的授权数据
          if (appIsNotInConfig || appIsInTenantBlacklist) {
            const details = appIsNotInConfig
              ? `App "${appId}" is not configured for cluster "${clusterId}" with appScope "${appScope}".`
              : `App "${appId}" with appScope "${appScope}" is not authorized for tenant "${tenantName}" ` +
                `in cluster "${clusterId}".`;
            throw new ServiceError({
              code: Status.NOT_FOUND,
              message: details,
              details,
            });
          }

          // 添加应用到默认授权应用时
          if (updateAction === UpdateDefaultAppRequest_UpdateAction.ADD_TO_DEFAULT_APPS) {
            await addToTenantDefaultApps(
              em,
              clusterId,
              tenantName,
              appId,
              appScope,
              foundCluster,
              logger,
              foundRemovedApp,
            );

            // 从默认授权应用中移除时
          } else {
            await removeFromTenantDefaultApps(
              em,
              clusterId,
              tenantName,
              appId,
              appScope,
              foundTenant,
              foundCluster,
              foundOperator,
              logger,
              foundRemovedApp,
            );
          }
          return [{ executed: true }] as [{ executed: boolean }];
        })
        .catch((error) => {
          if (error instanceof UniqueConstraintViolationException) {
            const details =
              `Default app "${appId}" with appScope "${appScope}" for tenant "${tenantName}" ` +
              `in cluster "${clusterId}" was already updated by a concurrent request.`;
            throw new ServiceError({
              code: Status.ALREADY_EXISTS,
              message: details,
              details,
            });
          }
          throw error;
        });
    },
  });
});
