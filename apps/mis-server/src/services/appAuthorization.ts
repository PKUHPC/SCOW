import { ServiceError } from "@ddadaal/tsgrpc-common";
import { plugin } from "@ddadaal/tsgrpc-server";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { raw } from "@mikro-orm/core";
import { libCheckActivatedClusters, libCheckAppIdInClusterApps } from "@scow/lib-server";
import { AppAuthorizationInfo, AppAuthorizationServiceServer,
  AppAuthorizationServiceService, AuthorizeAppRequest_AuthorizeAction,
  GetTargetAppAuthorizationsRequest_TargetType }
  from "@scow/protos/build/server/app_authorization";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { configClusters } from "src/config/clusters";
import { commonConfig } from "src/config/common";
import { Account, AccountState } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { User, UserState } from "src/entities/User";
import { UserAccount } from "src/entities/UserAccount";
import { formatTargetAppInfoList, getAiClusterAppConfigs, getClusterAppConfigs } from "src/utils/app";
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
        tenantName, filterTargetName } = request;
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

        const accountNameFilter = filterTargetName ? {
          accountName: { $like: `%${filterTargetName}%` },
        } : {};
        const [accounts, count] = await em.findAndCount(Account, {
          $and: [
            { tenant: { name: tenantName } },
            { state: { $ne: AccountState.DELETED } },
            accountNameFilter,
          ],
        },{
          populate: ["tenant"],
          ...paginationProps(page, pageSize || DEFAULT_PAGE_SIZE),
        });
        const accountNames = accounts.map((a) => a.accountName);
        const associatedTenant = accounts[0]?.tenant?.getProperty("name");

        const accountBlacklist = await em.find(AccountAppBlacklist, {
          ...clusterSearchParam,
          account: { accountName: { $in: accountNames } },
        }, {
          populate: ["cluster", "account"],
        });

        const associatedTenantBlacklist = await em.find(TenantAppBlacklist, {
          ...clusterSearchParam,
          tenant: { name: associatedTenant },
        }, {
          populate: ["cluster", "tenant"],
        });

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
      // 验证clusterId是否在当前在线集群中
      const foundCluster = await em.findOne(Cluster, { clusterId: clusterId });
      if (!foundCluster) {
        throw new ServiceError({
          code: Status.NOT_FOUND,
          message: `Cluster ${clusterId} is not found.`,
        });
      }
      const currentActivatedClusters = await getActivatedClusters(em, logger);
      libCheckActivatedClusters({ clusterIds: clusterId, activatedClusters: currentActivatedClusters, logger });

      // 验证user存在
      const foundOperator = await em.findOne(User, { userId: operatorId });
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

      // ************************************对帐户执行授权/取消授权APP操作************************************************
      if (target.$case === "accountName") {
        const foundAccount = await em.findOne(Account, { accountName: target.accountName },
          { populate: ["tenant"]});
        // 检查当前appId是否不在租户禁用app列表之中
        if (!foundAccount || foundAccount?.state === AccountState.DELETED) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Account ${target.accountName} is not found or has been deleted.`,
          });
        }
        const tenantName = foundAccount?.tenant.getProperty("name");
        const foundDisabledApp = await em.findOne(TenantAppBlacklist, {
          cluster: { clusterId: clusterId },
          tenant: { name: tenantName },
          appId: appId,
        });
        if (foundDisabledApp) {
          throw new ServiceError({
            code: Status.UNAVAILABLE,
            message: `Can not authorize the app ${appId} which is not authorized to account's tenant ${tenantName}.`,
          });
        }

        const accountDisabledAppItem = await em.findOne(AccountAppBlacklist, {
          account: { accountName: target.accountName },
          appId: appId,
          cluster: { clusterId: clusterId },
        });
        // 如果是授权交互式应用，则判断是否在当前账户禁用列表
        // 如果在则移除；如果不在则直接返回执行成功
        if (action === AuthorizeAppRequest_AuthorizeAction.AUTHORIZE) {
          if (!accountDisabledAppItem) {
            logger.info(`App ${appId} is already authorized to account ${target.accountName}`);
            return [{ executed: true }];
          } else {
            em.remove(accountDisabledAppItem);
          }
        // 如果是取消授权交互式应用，则判断是否在当前账户禁用列表
        // 如果在则直接返回执行成功
        // 如果不在则添加
        } else {
          if (accountDisabledAppItem) {
            logger.info(`App ${appId} has already been unauthorized to account ${target.accountName}`);
          } else {
            const newItem = new AccountAppBlacklist({
              account: foundAccount,
              appId: appId,
              cluster: foundCluster,
              operator: foundOperator,
            });
            em.persist(newItem);
          }
        }

      // ************************************对租户执行授权/取消授权APP操作************************************************
      } else {
        const foundTenant = await em.findOne(Tenant, { name: target.tenantName });
        if (!foundTenant) {
          throw new ServiceError({
            code: Status.NOT_FOUND,
            message: `Tenant ${target.tenantName} is not found.`,
          });
        }

        const foundTenantDisabledApp = await em.findOne(TenantAppBlacklist, {
          cluster: { clusterId: clusterId },
          tenant: { name: target.tenantName },
          appId: appId,
        }, { populate: ["tenant", "cluster"]});
        const foundAccountsDisableApps = await em.find(AccountAppBlacklist, {
          cluster: { clusterId: clusterId },
          account: { tenant: { name: target.tenantName } },
          appId: appId,
        }, { populate: ["account", "account.tenant", "cluster"]});

        // 如果是授权交互式应用，则该租户下所有账户也授权此应用
        if (action === AuthorizeAppRequest_AuthorizeAction.AUTHORIZE) {
          if (foundTenantDisabledApp) {
            em.remove(foundTenantDisabledApp);
          }

          if (foundAccountsDisableApps.length > 0) {
            em.remove([...foundAccountsDisableApps]);
          }
        // 如果是取消授权交互式应用，则判断是否在当前租户禁用列表
        // 默认同时取消授权租户下关联账户此应用
        } else {
          if (foundTenantDisabledApp) {
            logger.info(`App ${appId} has already been unauthorized to tenant ${target.tenantName}`);
          } else {
            const newItem = new TenantAppBlacklist({
              tenant: foundTenant,
              appId: appId,
              cluster: foundCluster,
              operator: foundOperator,
            });
            em.persist(newItem);
          }

          // 查询所有的账户包含已删除账户
          const tenantAccounts = await em.find(Account, { tenant: { name: target.tenantName } }, {
            populate: ["tenant"],
          });
          // 获取已存在的黑名单记录
          const existingBlacklists = await em.find(AccountAppBlacklist, {
            account: { tenant: { name: target.tenantName } },
            cluster: { clusterId: clusterId },
            appId: appId,
          });

          // 创建已存在账户的集合，用于快速查找
          const existingAccountIds = new Set(existingBlacklists.map((item) => item.account.id));

          // 只为不在黑名单中的账户创建新记录
          const newBlacklistItems = tenantAccounts
            .filter((account) => !existingAccountIds.has(account.id))
            .map((account) => new AccountAppBlacklist({
              account,
              appId,
              cluster: foundCluster,
              operator: foundOperator,
            }));

          if (newBlacklistItems.length > 0) {
            em.persist(newBlacklistItems);
          }
        }
      }

      // 持久化
      await em.flush();
      return [{ executed: true }];

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
        }).map((id) => ({
          id,
          name: clusterApps[id].name,
          logoPath: clusterApps[id].logoPath,
        }));

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
  });
});

