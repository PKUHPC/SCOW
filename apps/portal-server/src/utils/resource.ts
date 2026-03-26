import { getUserAccountsClusterPartitions } from "@scow/lib-scow-resource/build/utils";
import { libGetAccounts, libGetUserInfo } from "@scow/lib-server";
import { AccountStatusFilter } from "@scow/protos/build/portal/job";
import { Logger } from "pino";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";

export interface AccountAssignedResourceDetail {
  accountName: string;
  assignedClusterPartitions: Record<string, string[]>;
}

// 从 scow-resource 获取用户账户的集群分区授权信息，并使用 MIS 账户过滤。
export const getUserAssignedResourceDetails = async (
  logger: Logger,
  userId: string,
): Promise<AccountAssignedResourceDetail[]> => {
  if (!config.MIS_SERVER_URL || !commonConfig.scowResource?.enabled) {
    return [];
  }

  const userInfo = await libGetUserInfo(
    logger,
    userId,
    config.MIS_SERVER_URL,
    commonConfig.scowApi?.auth?.token,
  );
  const tenantName = userInfo.tenantName;
  if (!tenantName) {
    logger.warn(`Tenant of user ${userId} is not found when listing app available accounts.`);
    return [];
  }

  const { accounts } = await libGetAccounts(
    logger,
    userId,
    AccountStatusFilter.UNBLOCKED_ONLY,
    config.MIS_SERVER_URL,
    commonConfig.scowApi?.auth?.token,
  );

  const results = await Promise.allSettled(
    accounts.map(async (accountName) => {
      const assignedClusterPartitions = await getUserAccountsClusterPartitions(
        commonConfig.scowResource!,
        [accountName],
        tenantName,
      );
      return {
        accountName,
        assignedClusterPartitions,
      };
    }),
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    logger.info(`Error occurred when get user ${userId} assigned resource details: ${result.reason}`);
    return undefined;
  }).filter((result) => result !== undefined);
};
