import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { raw } from "@mikro-orm/core";
import { getI18nSeverTypeFormat, libCheckActivatedClusters, libCheckAppIdInClusterApps } from "@scow/lib-server";
import { AppAuthorizationInfo, AppAuthorizationServiceServer,
  AppAuthorizationServiceService,
  GetTargetAppAuthorizationsRequest_TargetType,
  GetTenantAppsResponse_TenantApp,
  UpdateDefaultAppRequest_UpdateAction }
  from "@scow/protos/build/server/app_authorization";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { Account, AccountState } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import { User, UserState } from "src/entities/User";
import { UserAccount, UserRole } from "src/entities/UserAccount";
import { getAiClusterAppConfigs, getClusterAppConfigs } from "src/utils/app";
import { addToTenantDefaultApps, authorizeAccountApp,
  authorizeTenantApp, formatTargetAppInfoList,
  removeFromTenantDefaultApps } from "src/utils/appAuthorization";
import { logger } from "src/utils/logger";
import { DEFAULT_PAGE_SIZE, paginationProps } from "src/utils/orm";

export const appAuthorizationServiceServer = plugin((server) => {
  server.addService<AppAuthorizationServiceServer>(AppAuthorizationServiceService, {
    getTargetAppAuthorizations: async ({ request, em }) => {

      // 验证功能是否开启
      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }

      const { pageSize, page, clusterId, targetType,
        tenantName, filterTargetName, filterAccountOwnerIdOrName } = request;
      if (targetType === GetTargetAppAuthorizationsRequest_TargetType.UNKNOWN) {
        throw new ServiceError({
          code: Status.INVALID_ARGUMENT,
          message: "Request target of tenant or account is not found.",
        });
      }

      // 检查集群是否为在线集群
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });
      const clusterSearchParam = { cluster: { clusterId: clusterId } };

      // 获得集群下交互式应用列表
      const clusterConfigAppInfos: Record<string, AppAuthorizationInfo[]> = {};
      const clusterAppIds: Record<string, string[]> = {};
      // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
      const clusterApps = configClusters[clusterId].ai?.enabled
        ? getAiClusterAppConfigs(clusterId)
        : getClusterAppConfigs(clusterId);
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
        const [tenants, count] = await em.findAndCount(Tenant,
          filterTargetName
            ? { name: { $like: `%${filterTargetName}%` } }
            : {},
          { ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE) },
        );

        const tenantNames = tenants.map((t) => t.name);
        const tenantsBlacklist = await em.find(TenantAppBlacklist, {
          ...clusterSearchParam,
          tenant: { name: { $in: tenantNames } },
        }, {
          populate: ["cluster", "tenant"],
        });
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
          accountName: string,
          tenantName: string,
          accountOwnerId: string | undefined,
          accountOwnerName: string | undefined,
        }

        const qb = em.createQueryBuilder(Account, "a");
        qb
          .leftJoin("a.tenant", "t")
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

        if (filterTargetName) {
          qb.andWhere({
            "a.account_name": { $like: `%${filterTargetName}%` },
          });
        }

        if (filterAccountOwnerIdOrName) {
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
        const accountOwnerMap = new Map<string, { ownerId?: string, ownerName?: string }>();
        accountsRaw.forEach((r) => {
          accountOwnerMap.set(r.accountName, {
            ownerId: r.accountOwnerId || undefined,
            ownerName: r.accountOwnerName || undefined,
          });
        });

        const [accountBlacklist, associatedTenantBlacklist] = await Promise.all([
          em.find(AccountAppBlacklist, {
            ...clusterSearchParam,
            account: { accountName: { $in: accountNames } },
          }, { populate: ["cluster", "account"]}),
          em.find(TenantAppBlacklist, {
            ...clusterSearchParam,
            tenant: { name: associatedTenant },
          }, { populate: ["cluster", "tenant"]}),
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

      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }

      const { clusterId, appId, operatorId, action, target } = request;

      if (!target) {
        throw new ServiceError({
          code: Status.INVALID_ARGUMENT,
          message: "Request target of tenant or account is not found.",
        });
      }

      return await em.transactional(async (em) => {

        const [foundCluster, foundOperator] = await Promise.all([
          em.findOne(Cluster, { clusterId: clusterId }),
          em.findOne(User, { userId: operatorId }),
        ]);
        // 验证clusterId是否在当前在线集群中
        if (!foundCluster) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Cluster ${clusterId} is not found.`,
          });
        }
        const currentActivatedClusters = await getActivatedClusters(em, logger);
        libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

        // 验证user存在
        if (!foundOperator || foundOperator.state === UserState.DELETED) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Operator ${operatorId} is not found or deleted.`,
          });
        }

        // 验证appId是否在当前交互式应用列表中
        // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
        const clusterApps = configClusters[clusterId].ai?.enabled
          ? getAiClusterAppConfigs(clusterId)
          : getClusterAppConfigs(clusterId);

        libCheckAppIdInClusterApps({ appId, appIds: Object.keys(clusterApps), clusterId, logger });

        if (target.$case === "accountName") {
          await authorizeAccountApp(
            em, target.accountName, clusterId, appId, action, foundCluster, foundOperator, logger);
          // ************************************对租户执行授权/取消授权APP操作************************************************
        } else {
          await authorizeTenantApp(
            em, target.tenantName, clusterId, appId, action, foundCluster, foundOperator, logger);
        }

        return [{ executed: true }];

      });
    },

    getUserAvailableClusterApps: async ({ request, em }) => {

      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }

      const { clusterId, userId } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      return await em.transactional(async (em) => {

        const foundUser = await em.findOne(User, { userId: userId });
        if (!foundUser || foundUser.state === UserState.DELETED) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: "User is not found or is deleted.",
          });
        }

        // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
        const clusterApps = configClusters[clusterId].ai?.enabled
          ? getAiClusterAppConfigs(clusterId)
          : getClusterAppConfigs(clusterId);

        const currentClusterAppIds = Object.keys(clusterApps);
        if (currentClusterAppIds.length === 0) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: "No available apps. Please confirm the app config files.",
          });
        }

        // 查询当前用户关联的未删除的账户列表
        const qb = em.createQueryBuilder(UserAccount, "ua");
        const accounts: { accountName: string }[] = await qb
          .join("ua.user", "u")
          .join("ua.account", "a")
          .select("a.account_name AS accountName")
          .where({ "u.userId": userId })
          .andWhere({ "a.state": { $ne: AccountState.DELETED } })
          .execute();

        const accountNames = accounts.map((a) => a.accountName);

        const accountsBlacklist = await em.find(AccountAppBlacklist, {
          cluster: { clusterId: clusterId },
          account: {
            accountName: { $in: accountNames },
          },
        }, {
          populate: ["cluster", "account"],
        });

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
        const availableApps = currentClusterAppIds.filter((appId) => {
          // 如果没有账户，直接返回true
          if (accountNames.length === 0) return true;
          return !accountNames.every((accountName) =>
            accountBlackAppsMap.get(accountName)?.has(appId) || false);
        }).map((id) => {
          const appConfig = clusterApps[id];
          const imageConfig = (appConfig as { image?: { name: string; tag?: string } }).image;
          const webStartCommand =
            (appConfig.web as { startCommand?: string } | undefined)?.startCommand;

          return {
            id,
            name: appConfig.name,
            logoPath: appConfig.logoPath,
            comment: appConfig.appComment ? getI18nSeverTypeFormat(appConfig.appComment) : undefined,
            image: imageConfig ? `${imageConfig.name}:${imageConfig.tag ?? "latest"}` : undefined,
            startCommand: webStartCommand ?? appConfig.vnc?.xstartup,
          };
        });

        logger.trace("Available apps: %o for user: %s in cluster: %s", availableApps, userId, clusterId);

        return [ { apps: availableApps } ];

      });
    },

    getAppForbiddenAccounts: async ({ request, em }) => {

      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }

      const { clusterId, appId } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
      const clusterApps = configClusters[clusterId].ai?.enabled
        ? getAiClusterAppConfigs(clusterId)
        : getClusterAppConfigs(clusterId);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        throw new ServiceError({
          code: Status.NOT_FOUND,
          message: "No available apps. Please confirm the app config files.",
        });
      }
      libCheckAppIdInClusterApps({ appId, appIds: currentClusterAppIds, clusterId, logger });

      const qb = em.createQueryBuilder(AccountAppBlacklist, "aab");
      const accounts: { accountName: string }[] = await qb
        .join("aab.cluster", "c")
        .join("aab.account", "a")
        .select(raw("a.account_name AS accountName"))
        .where({ "aab.appId": appId })
        .andWhere({ "c.clusterId": clusterId })
        .andWhere({ "a.state": { $ne: AccountState.DELETED } })
        .execute();

      const accountNames = accounts.map((a) => a.accountName);
      logger.trace("Forbidden accounts: %s for appId: %s in cluster: %s",
        accountNames.join(","), appId, clusterId);

      return [{ accountNames }];
    },

    checkAppIsDisabled: async ({ request, em }) => {
      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }

      const { clusterId, appId, accountName } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
      const clusterApps = configClusters[clusterId].ai?.enabled
        ? getAiClusterAppConfigs(clusterId)
        : getClusterAppConfigs(clusterId);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        throw new ServiceError({
          code: Status.NOT_FOUND,
          message: "No available apps. Please confirm the app config files.",
        });
      }
      libCheckAppIdInClusterApps({ appId, appIds: currentClusterAppIds, clusterId, logger });
      const found = await em.findOne(AccountAppBlacklist, {
        cluster: { clusterId: clusterId },
        appId: appId,
        account: { accountName: accountName },
      }, {
        populate: ["cluster", "account"],
      });

      return [{ isDisabled: !!found }];
    },

    getTenantApps: async ({ request , em }) => {

      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }

      const { clusterId, tenantName } = request;
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
      const clusterApps = configClusters[clusterId].ai?.enabled
        ? getAiClusterAppConfigs(clusterId)
        : getClusterAppConfigs(clusterId);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        // 该集群下没有可以使用的交互式应用
        return [{ tenantApps: []}];
      }

      return await em.transactional(async (em) => {

        const [tenantBlackApps, tenantDefaultRemovedApps] = await Promise.all([
          em.find(TenantAppBlacklist, {
            cluster: { clusterId },
            tenant: { name: tenantName },
          }, { populate: ["tenant", "cluster"]}),

          em.find(TenantDefaultAppRemovedList, {
            cluster: { clusterId },
            tenant: { name: tenantName },
          }, { populate: ["tenant", "cluster"]}),
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

        return [ { tenantApps } ];

      });
    },


    updateDefaultApp: async ({ request, em }) => {

      if (!commonConfig.allowAppAuthorization) {
        throw new ServiceError({
          code: Status.FAILED_PRECONDITION,
          message: "App Authorization is not supported. Please confirm the common config file.",
        });
      }
      const { clusterId, tenantName, appId, updateAction, operatorId } = request;

      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      // 如果集群开启了 AI 功能，在当前版本下默认为此集群为AI集群，获取AI集群下的交互式应用列表
      const clusterApps = configClusters[clusterId].ai?.enabled
        ? getAiClusterAppConfigs(clusterId)
        : getClusterAppConfigs(clusterId);
      const currentClusterAppIds = Object.keys(clusterApps);
      if (currentClusterAppIds.length === 0) {
        // 该集群下没有可以使用的交互式应用
        logger.info("There is no app configs in the cluster: %s", clusterId);
      }

      const appIsNotInConfig = !currentClusterAppIds.includes(appId);

      return await em.transactional(async (em) => {

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
          em.findOne(TenantDefaultAppRemovedList, {
            cluster: { clusterId: clusterId },
            tenant: { name: tenantName },
            appId: appId,
          }, { populate: ["cluster", "tenant"]}),
          em.find(TenantAppBlacklist, {
            cluster: { clusterId: clusterId },
            tenant: { name: tenantName },
          }, { populate: ["tenant", "cluster"]}),
        ]);

        if (!foundTenant) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Tenant ${tenantName} is not found.`,
          });
        }
        if (!foundCluster) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Cluster ${clusterId} is not found.`,
          });
        }
        if (!foundOperator) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Operator ${operatorId} is not found.`,
          });
        }

        const appIsInTenantBlacklist = tenantBlackApps.map((app) => app.appId)?.includes(appId);
        // appId 不在config配置文件中
        // 或者 在租户禁用app列表中
        // 添加或移除均认为失败，不去更新租户下账户的授权数据
        if (appIsNotInConfig || appIsInTenantBlacklist) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message:
              `App ${appId} is not in apps config of cluster ${clusterId} or is blocked to tenant ${tenantName}.`,
          });
        }


        // 添加应用到默认授权应用时
        if (updateAction === UpdateDefaultAppRequest_UpdateAction.ADD_TO_DEFAULT_APPS) {
          await addToTenantDefaultApps(em, clusterId, tenantName, appId, foundCluster, logger, foundRemovedApp);

        // 从默认授权应用中移除时
        } else {
          await removeFromTenantDefaultApps(em, clusterId, tenantName, appId,
            foundTenant, foundCluster, foundOperator, logger, foundRemovedApp);
        }
        return [{ executed: true }];
      });
    },


  });
});
