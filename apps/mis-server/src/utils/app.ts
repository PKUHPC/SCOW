import { getAppConfigs as libGetAppConfigs } from "@scow/config/build/app";
import { getAiAppConfigs as libGetAiAppConfigs } from "@scow/config/build/appForAi";
import { AppConfigSchema as AiAppConfigSchema } from "@scow/config/build/appForAi";
import { DEFAULT_CONFIG_BASE_PATH } from "@scow/config/build/constants";
import { AppAuthorizationInfo, GetTargetAppAuthorizationsRequest_TargetType,
  TargetAppList } from "@scow/protos/build/server/app_authorization";
import { join } from "path";
import { Logger } from "pino";
import { AccountAppBlacklist } from "src/entities/AccountAppBlacklist";
import { TenantAppBlacklist } from "src/entities/TenantAppBlacklist";

import { logger } from "./logger";

export const getAppConfigs = (clusterBasePath?: string) => libGetAppConfigs(clusterBasePath, logger);

export const getClusterAppConfigs = (cluster: string) => {

  const commonApps = getAppConfigs();

  const clusterAppsConfigs = getAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));

  const apps = {} as Record<string, typeof commonApps[number]>;

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  for (const [key, value] of Object.entries(clusterAppsConfigs)) {
    apps[key] = value;
  }

  return apps;

};


export const getAiClusterAppConfigs = (cluster: string) => {

  const commonApps = libGetAiAppConfigs();

  const clusterAppsConfigs = libGetAiAppConfigs(join(DEFAULT_CONFIG_BASE_PATH, "clusters/", cluster));

  const apps: Record<string, AiAppConfigSchema> = {};

  for (const [key, value] of Object.entries(commonApps)) {
    apps[key] = value;
  }

  for (const [key, value] of Object.entries(clusterAppsConfigs)) {
    apps[key] = value;
  }

  return apps;

};


/**
 * 封装租户或账户的应用列表，返回对应集群下的禁用与可用app
 */
export const formatTargetAppInfoList = (
  logger: Logger,
  clusterId: string,
  // 租户或账户名数组
  targetNames: string[],
  // 实体中租户或账户禁用APP列表数据
  targetBlacklist: TenantAppBlacklist[] | AccountAppBlacklist[],
  clusterConfigAppInfos: Record<string, AppAuthorizationInfo[]>,
  clusterAppIds: Record<string, string[]>,
  // 查询类型:租户或账户
  targetType: GetTargetAppAuthorizationsRequest_TargetType,
  totalCount: number,
  // 类型是账户时：所属租户被禁用的app列表数据
  associatedTenantBlacklist?: TenantAppBlacklist[] | undefined,
): {
  appLists: TargetAppList[],
  totalCount: number,
} => {

  // 如果要查询的类型时租户管理员下的账户授权应用，则初始化可用的应用列表为未在所属租户下被禁用的账户列表
  const initialAppInfos = targetType === GetTargetAppAuthorizationsRequest_TargetType.TENANT
    ? clusterConfigAppInfos[clusterId]
    : clusterConfigAppInfos[clusterId].filter((a) => (
      !associatedTenantBlacklist?.find((x) => x.appId === a.appId)));

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
    const targetName = targetType === GetTargetAppAuthorizationsRequest_TargetType.TENANT ?
      (item as TenantAppBlacklist).tenant.getProperty("name") :
      (item as AccountAppBlacklist).account.getProperty("accountName");

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
    appLists.push({
      targetName,
      appsInfo: appsInfo,
      availableAppsCount: appsInfo.filter((a) => (!a.isDisabled)).length,
    });
  });
  logger.trace("Current app lists: %o", appLists);


  return {
    appLists,
    totalCount,
  };

};
