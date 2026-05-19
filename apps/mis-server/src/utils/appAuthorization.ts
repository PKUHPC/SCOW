import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { Loaded, MySqlDriver, PopulatePath, SqlEntityManager } from "@mikro-orm/mysql";
import {
  AppAuthorizationInfo,
  AuthorizeAppRequest_AuthorizeAction,
  GetTargetAppAuthorizationsRequest_TargetType,
  TargetAppList,
} from "@scow/protos/build/server/app_authorization";
import { Logger } from "pino";
import { Account, AccountState } from "src/entities/Account";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { Cluster } from "src/entities/Cluster";
import { Tenant } from "src/entities/Tenant";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";
import { TenantDefaultAppRemovedList } from "src/entities/TenantDefaultAppRemovedList";
import { User } from "src/entities/User";

/**
 * 封装租户或账户的应用列表，返回对应集群下的禁用与可用app
 */
export const formatTargetAppInfoList = (
  logger: Logger,
  clusterId: string,
  // 租户或账户名数组
  targetNames: string[],
  // 实体中租户或账户禁用APP列表数据
  targetBlacklist:
    | Loaded<TenantAppBlacklist, "tenant" | "cluster", PopulatePath.ALL, never>[]
    | Loaded<AccountAppBlacklist, "account" | "cluster", PopulatePath.ALL, never>[],
  clusterConfigAppInfos: Record<string, AppAuthorizationInfo[]>,
  clusterAppIds: Record<string, string[]>,
  // 查询类型:租户或账户
  targetType: GetTargetAppAuthorizationsRequest_TargetType,
  totalCount: number,
  // 类型是账户时：所属租户被禁用的app列表数据
  associatedTenantBlacklist?: Loaded<TenantAppBlacklist, "tenant" | "cluster", PopulatePath.ALL, never>[],
  // 类型是账户时: 返回账户的拥有者信息
  accountOwnerMap?: Map<
    string,
    {
      ownerId?: string | undefined;
      ownerName?: string | undefined;
    }
  >,
): {
  appLists: TargetAppList[];
  totalCount: number;
} => {
  // 如果要查询的类型时租户管理员下的账户授权应用，则初始化可用的应用列表为未在所属租户下被禁用的账户列表
  const initialAppInfos =
    targetType === GetTargetAppAuthorizationsRequest_TargetType.TENANT
      ? clusterConfigAppInfos[clusterId]
      : clusterConfigAppInfos[clusterId].filter((a) => !associatedTenantBlacklist?.find((x) => x.appId === a.appId));

  // 初始化一个应用列表的结果对象
  const appLists: TargetAppList[] = [];

  // 为每个租户或账户创建初始全部可用的应用列表
  const targetApps = new Map<string, AppAuthorizationInfo[]>();
  targetNames.forEach((targetName) => {
    // 深拷贝
    targetApps.set(targetName, JSON.parse(JSON.stringify(initialAppInfos)));
  });
  logger.trace("Current initial targetAppsMap: %o", targetApps);

  for (const item of targetBlacklist) {
    const clusterId = item.cluster.getProperty("clusterId");
    const targetName =
      targetType === GetTargetAppAuthorizationsRequest_TargetType.TENANT
        ? (item as TenantAppBlacklist).tenant.getProperty("name")
        : (item as AccountAppBlacklist).account.getProperty("accountName");

    // 只判断存在于当前集群应用列表中的appId
    // 如果表单中存在的appId已不再当前集群应用列表下，不删除数据
    // 再次使用相同appId时默认沿用上次禁用表单
    if (clusterAppIds[clusterId].includes(item.appId)) {
      const appsList = targetApps?.get(targetName);
      const appToDisable = appsList?.find((app) => app.appId === item.appId);
      if (appToDisable) {
        appToDisable.isDisabled = true;
      }
    }
  }
  logger.trace("Current targetApps if has black app lists: %o", targetApps);
  targetApps.forEach((appsInfo, targetName) => {
    const owner =
      targetType === GetTargetAppAuthorizationsRequest_TargetType.ACCOUNT
        ? accountOwnerMap?.get(targetName)
        : undefined;
    appLists.push({
      targetName,
      appsInfo: appsInfo,
      availableAppsCount: appsInfo.filter((a) => !a.isDisabled).length,
      // 类型是账户时返回对应拥有者信息
      accountOwnerId:
        targetType === GetTargetAppAuthorizationsRequest_TargetType.ACCOUNT ? (owner?.ownerId ?? "-") : undefined,
      accountOwnerName:
        targetType === GetTargetAppAuthorizationsRequest_TargetType.ACCOUNT ? (owner?.ownerName ?? "-") : undefined,
    });
  });
  logger.trace("Current app lists: %o", appLists);

  return {
    appLists,
    totalCount,
  };
};

/**
 * 对账户执行授权/取消授权APP操作
 * @param em
 * @param accountName
 * @param clusterId
 * @param appId
 * @param action
 * @param foundCluster
 * @param foundOperator
 * @param logger
 */
export async function authorizeAccountApp(
  em: SqlEntityManager<MySqlDriver>,
  accountName: string,
  clusterId: string,
  appId: string,
  action: AuthorizeAppRequest_AuthorizeAction,
  foundCluster: Loaded<Cluster, never, "*", never>,
  foundOperator: Loaded<User, never, "*", never>,
  logger: Logger,
): Promise<void> {
  const foundAccount = await em.findOne(Account, { accountName: accountName }, { populate: ["tenant"] });
  // 检查当前appId是否不在租户禁用app列表之中
  if (!foundAccount || foundAccount?.state === AccountState.DELETED) {
    throw new ServiceError({
      code: Status.NOT_FOUND,
      message: `Account ${accountName} is not found or has been deleted.`,
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
    account: { accountName: accountName },
    appId: appId,
    cluster: { clusterId: clusterId },
  });
  // 如果是授权交互式应用，则判断是否在当前账户禁用列表
  // 如果在则移除；如果不在则直接返回执行成功
  if (action === AuthorizeAppRequest_AuthorizeAction.AUTHORIZE) {
    if (!accountDisabledAppItem) {
      logger.info(`App ${appId} is already authorized to account ${accountName}`);
    } else {
      em.remove(accountDisabledAppItem);
    }
    // 如果是取消授权交互式应用，则判断是否在当前账户禁用列表
    // 如果在则直接返回执行成功
    // 如果不在则添加
  } else {
    if (accountDisabledAppItem) {
      logger.info(`App ${appId} has already been unauthorized to account ${accountName}`);
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
  await em.flush();
}

/**
 * 对租户执行授权/取消授权APP操作
 * @param em
 * @param tenantName
 * @param clusterId
 * @param appId
 * @param action 授权或取消授权
 * @param foundCluster 当前集群的Cluster实体
 * @param foundOperator 当前操作者的User实体
 * @param logger
 */
export async function authorizeTenantApp(
  em: SqlEntityManager<MySqlDriver>,
  tenantName: string,
  clusterId: string,
  appId: string,
  action: AuthorizeAppRequest_AuthorizeAction,
  foundCluster: Loaded<Cluster, never, "*", never>,
  foundOperator: Loaded<User, never, "*", never>,
  logger: Logger,
): Promise<void> {
  const [foundTenant, foundTenantDisabledApp] = await Promise.all([
    em.findOne(Tenant, { name: tenantName }),
    em.findOne(
      TenantAppBlacklist,
      {
        cluster: { clusterId: clusterId },
        tenant: { name: tenantName },
        appId: appId,
      },
      { populate: ["tenant", "cluster"] },
    ),
  ]);

  if (!foundTenant) {
    throw new ServiceError({
      code: Status.NOT_FOUND,
      message: `Tenant ${tenantName} is not found.`,
    });
  }

  // 如果是授权交互式应用
  // 只授权给租户，不对租户下账户进行操作
  if (action === AuthorizeAppRequest_AuthorizeAction.AUTHORIZE) {
    if (foundTenantDisabledApp) {
      em.remove(foundTenantDisabledApp);
    } else {
      logger.info(`App ${appId} has already been authorized to tenant ${tenantName}`);
    }
    // 如果是取消授权交互式应用，则判断是否在当前租户禁用列表
    // 默认同时取消租户的默认应用
    // 默认同时取消授权租户下关联账户此应用
  } else {
    // 查询所有的账户包含已删除账户
    // 获取已存在的黑名单记录
    const [tenantAccounts, existingBlacklists] = await Promise.all([
      em.find(
        Account,
        { tenant: { name: tenantName } },
        {
          populate: ["tenant"],
        },
      ),
      em.find(AccountAppBlacklist, {
        account: { tenant: { name: tenantName } },
        cluster: { clusterId: clusterId },
        appId: appId,
      }),
    ]);

    // 创建已存在账户的集合，用于快速查找
    const existingAccountIds = new Set(existingBlacklists.map((item) => item.account.id));

    // 只为不在黑名单中的账户创建新记录
    const newBlacklistItems = tenantAccounts
      .filter((account) => !existingAccountIds.has(account.id))
      .map(
        (account) =>
          new AccountAppBlacklist({
            account,
            appId,
            cluster: foundCluster,
            operator: foundOperator,
          }),
      );

    if (newBlacklistItems.length > 0) {
      // 使用InsertMany减少事务内数据更新时间
      await em.insertMany(AccountAppBlacklist, newBlacklistItems);
    }

    // 移出租户的默认授权应用
    const foundRemovedDefaultApp = await em.findOne(
      TenantDefaultAppRemovedList,
      {
        cluster: { clusterId: clusterId },
        tenant: { name: tenantName },
        appId: appId,
      },
      { populate: ["tenant", "cluster"] },
    );

    if (foundRemovedDefaultApp) {
      logger.info(`App ${appId} has already been removed from default apps of tenant ${tenantName}`);
    } else {
      const newRemovedDefaultItem = new TenantDefaultAppRemovedList({
        tenant: foundTenant,
        appId: appId,
        cluster: foundCluster,
      });
      em.persist(newRemovedDefaultItem);
    }

    // 写入租户禁用应用
    if (foundTenantDisabledApp) {
      logger.info(`App ${appId} has already been unauthorized to tenant ${tenantName}`);
    } else {
      const newItem = new TenantAppBlacklist({
        tenant: foundTenant,
        appId: appId,
        cluster: foundCluster,
        operator: foundOperator,
      });
      em.persist(newItem);
    }
  }
  await em.flush();
}

export async function addToTenantDefaultApps(
  em: SqlEntityManager<MySqlDriver>,
  clusterId: string,
  tenantName: string,
  appId: string,
  foundCluster: Loaded<Cluster, never, "*", never>,
  logger: Logger,
  foundRemovedApp: Loaded<TenantDefaultAppRemovedList, "tenant" | "cluster", "*", never> | null,
): Promise<void> {
  // 已经移除的默认应用中没有找到该应用
  // 表示此应用已经被添加过默认应用
  // 提示错误信息，不更新账户数据
  if (!foundRemovedApp) {
    throw new ServiceError({
      code: Status.ALREADY_EXISTS,
      message: `The app ${appId} in cluster ${clusterId} has already been default app of tenant ${tenantName}`,
    });

    // 从已移除默认应用表单中删除
    // 同时对本租户下所有账户授权该应用
  } else {
    const deletedCount = await em.nativeDelete(AccountAppBlacklist, {
      account: { tenant: { name: tenantName } },
      cluster: foundCluster,
      appId: appId,
    });
    await em.removeAndFlush(foundRemovedApp);
    logger.info(`Removed ${deletedCount} blacklist entries for app ${appId} in tenant ${tenantName}`);
  }
}

export async function removeFromTenantDefaultApps(
  em: SqlEntityManager<MySqlDriver>,
  clusterId: string,
  tenantName: string,
  appId: string,
  foundTenant: Loaded<Tenant, never, "*", never>,
  foundCluster: Loaded<Cluster, never, "*", never>,
  foundOperator: Loaded<User, never, "*", never>,
  logger: Logger,
  foundRemovedApp: Loaded<TenantDefaultAppRemovedList, "tenant" | "cluster", "*", never> | null,
): Promise<void> {
  // 已经从默认应用中移除时
  // 提示错误信息，不更新账户数据
  if (foundRemovedApp) {
    throw new ServiceError({
      code: Status.ALREADY_EXISTS,
      message:
        `The app ${appId} in cluster ${clusterId} has already been removed from ` +
        `default apps of tenant ${tenantName}`,
    });

    // 移除默认应用
    // 同时移除该租户下所有账户该应用的授权
  } else {
    // 查询所有的账户包含已删除账户
    // 获取已存在的黑名单记录
    const [tenantAccounts, existingBlacklists] = await Promise.all([
      em.find(
        Account,
        { tenant: { name: tenantName } },
        {
          populate: ["tenant"],
        },
      ),
      em.find(AccountAppBlacklist, {
        account: { tenant: { name: tenantName } },
        cluster: { clusterId: clusterId },
        appId: appId,
      }),
    ]);

    // 创建已存在账户的集合，用于快速查找
    const existingAccountIds = new Set(existingBlacklists.map((item) => item.account.id));

    // 只为不在黑名单中的账户创建新记录
    const newBlacklistItems = tenantAccounts
      .filter((account) => !existingAccountIds.has(account.id))
      .map(
        (account) =>
          new AccountAppBlacklist({
            account,
            appId,
            cluster: foundCluster,
            operator: foundOperator,
          }),
      );

    if (newBlacklistItems.length > 0) {
      // 使用InsertMany减少事务内数据更新时间
      await em.insertMany(AccountAppBlacklist, newBlacklistItems);
    }

    // 添加要移除的租户应用到租户默认应用移除表单
    const newItem = new TenantDefaultAppRemovedList({
      tenant: foundTenant,
      appId: appId,
      cluster: foundCluster,
    });
    await em.persistAndFlush(newItem);
  }
}
