import { isAccountAuthorizedInClusterPartition } from "@scow/lib-scow-resource/build/utils";
import { libCheckAppIsDisabled, libCheckUserAccountPermission } from "@scow/lib-server";
import { AccountStatusFilter } from "@scow/protos/build/portal/job";
import { Logger } from "pino";
import { commonConfig } from "src/server/config/common";
import { config } from "src/server/config/env";

import { DetailedTRPCError } from "./detailedError";

/**
 *
 * @param checkAccountApp 是否需要检查授权应用
 * @param appId 如果需要检查授权应用，则必须传入应用ID
 */
export async function validateSubmitAiJobInfoUnderMis({
  userId,
  accountName,
  clusterId,
  logger,
  partitionName,
  checkAccountApp,
  appId,
}: {
  userId: string;
  accountName: string;
  clusterId: string;
  logger: Logger;
  partitionName?: string;
  checkAccountApp?: boolean;
  appId?: string;
}): Promise<void> {
  // 1.检查账户是否是未封锁状态
  const isUserAvailableInAccount = await libCheckUserAccountPermission(
    logger,
    userId,
    accountName,
    AccountStatusFilter.UNBLOCKED_ONLY,
    config.MIS_SERVER_URL,
    commonConfig.scowApi?.auth?.token,
  );
  if (!isUserAvailableInAccount) {
    throw new DetailedTRPCError({
      code: "FORBIDDEN",
      message: `User ${userId} is not available in account ${accountName}`,
      detail: {
        type: "account_user_not_available",
        userId,
        accountName,
      },
    });
  }

  // 2.如果配置资源管理，检查集群分区是否已授权
  if (commonConfig.scowResource?.enabled) {
    const isClusterPartitionAuthorized = await isAccountAuthorizedInClusterPartition(
      commonConfig.scowResource,
      accountName,
      clusterId,
      partitionName,
    );
    if (!isClusterPartitionAuthorized) {
      throw new DetailedTRPCError({
        code: "FORBIDDEN",
        message:
          `Account ${accountName} is not authorized in cluster ${clusterId}` +
          (partitionName ? ` and partition ${partitionName}` : ""),
        detail: {
          type: "cluster_partition_not_available",
          accountName,
          clusterId,
          partitionName,
        },
      });
    }
  }

  // 3.如果需要检查授权应用时
  // 则增加判断开启授权应用，检查应用是否已对账户禁用
  if (checkAccountApp && !appId) {
    throw new DetailedTRPCError({
      code: "FORBIDDEN",
      message: "The app is not provided when checking app authorization",
      detail: {
        type: "app_not_available",
        appId: undefined,
        accountName,
      },
    });
  }
  if (checkAccountApp && appId && commonConfig.allowAppAuthorization) {
    const isAppDisabledToAccount = await libCheckAppIsDisabled(
      logger,
      clusterId,
      appId,
      accountName,
      config.MIS_SERVER_URL,
      commonConfig.scowApi?.auth?.token,
    );

    if (isAppDisabledToAccount) {
      throw new DetailedTRPCError({
        code: "FORBIDDEN",
        message: `The appId ${appId} is disabled to account ${accountName}`,
        detail: {
          type: "app_not_available",
          appId,
          accountName,
        },
      });
    }
  }
}
