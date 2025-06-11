import { getCommonConfig } from "@scow/config/src/common";
import { getUserAccountsClusterPartitions } from "@scow/lib-scow-resource/build/utils";
import { libGetAccounts } from "@scow/lib-server";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { accountStatusFilterFromJSON } from "@scow/protos/build/portal/job";
import { AccountAssignedResourceDetail, AccountStatusFilter } from "src/models/Resource";
import { config } from "src/server/config/env";

import { logger } from "./logger";

export async function getAssignedClusterPartitions(userId: string): Promise<Record<string, string[]> | undefined> {

  const commonConfig = getCommonConfig();

  // 如果没有部署管理系统或者资源管理系统为不可用，返回空
  if (!config.MIS_SERVER_URL || !commonConfig.scowResource?.enabled) {
    return undefined;
  }

  const userAffliction
       = await libWebGetUserInfo(userId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);

  const accountNames = userAffliction?.affiliations.map((a) => (a.accountName));
  const tenantName = userAffliction?.tenantName;

  if (!tenantName) {
    logger.info(`Afflicted tenant of user id: ${userId} is not found.`);
    return undefined;
  }
  const results
       = await getUserAccountsClusterPartitions(commonConfig.scowResource, accountNames, tenantName);

  if (Object.keys(results).length === 0) {
    logger.info(`Can not find authorized clusters for the user id: ${userId}.`);
  }

  return results;
}

export async function getUserAssignedResourceDetails(
  userId: string,
  accountStatusFilter?: AccountStatusFilter,
): Promise<AccountAssignedResourceDetail[] | undefined> {

  const commonConfig = getCommonConfig();

  // 如果没有部署管理系统或者资源管理系统为不可用，返回空
  if (!config.MIS_SERVER_URL || !commonConfig.scowResource?.enabled) {
    return undefined;
  }

  const userInfo
       = await libWebGetUserInfo(userId, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);
  const tenantName = userInfo?.tenantName;

  if (!tenantName) {
    logger.info(`Afflicted tenant of user id: ${userId} is not found.`);
    return undefined;
  }

  const associatedAccounts = await libGetAccounts(
    logger,
    userId,
    accountStatusFilter ? accountStatusFilterFromJSON(accountStatusFilter) : undefined,
    config.MIS_SERVER_URL,
    commonConfig.scowApi?.auth?.token,
  );

  const results
    = await Promise.allSettled(associatedAccounts.accounts.map(async (accountName: string) => {
      const accountAssignedClustersPartitions = await getUserAccountsClusterPartitions(
        commonConfig.scowResource!, [accountName], tenantName);

      return {
        accountName,
        assignedClusterPartitions: accountAssignedClustersPartitions,
      };
    }));
  const fulfilledResults = results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    logger.info(`Error occurred when get user ${userId} assigned resource details: ${result.reason}`);
    return undefined;
  }).filter((result) => result !== undefined);

  if (fulfilledResults.length === 0) {
    logger.info(`Can not find authorized resource details for the user id: ${userId}.`);
  }

  return fulfilledResults;
}

