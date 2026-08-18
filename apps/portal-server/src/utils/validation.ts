import { Status } from "@grpc/grpc-js/build/src/constants";
import { isAccountAuthorizedInClusterPartition } from "@scow/lib-scow-resource/build/utils";
import { AppScope, errorInfo, libCheckAppIsDisabled, libCheckUserAccountPermission } from "@scow/lib-server";
import { AccountStatusFilter } from "@scow/protos/build/portal/job";
import { DetailedError } from "@scow/rich-error-model";
import { Logger } from "pino";
import { commonConfig } from "src/config/common";
import { config } from "src/config/env";

/**
 *
 * @param checkAccountApp 是否需要检查授权应用
 * @param appId 如果需要检查授权应用，则必须传入应用ID
 */
export async function validateSubmitJobInfoUnderMis({
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
    commonConfig.scowApi.auth.token,
  );
  if (!isUserAvailableInAccount) {
    throw new DetailedError({
      code: Status.PERMISSION_DENIED,
      message: `User ${userId} is not available in account ${accountName}`,
      details: [errorInfo("USER_ACCOUNT_NOT_AVAILABLE")],
    });
  }

  const isClusterPartitionAuthorized = await isAccountAuthorizedInClusterPartition(
    commonConfig.scowResource,
    accountName,
    clusterId,
    partitionName,
  );
  if (!isClusterPartitionAuthorized) {
    throw new DetailedError({
      code: Status.PERMISSION_DENIED,
      message:
        `Account ${accountName} is not authorized in cluster ${clusterId}` +
        (partitionName ? ` and partition ${partitionName}` : ""),
      details: [errorInfo("CLUSTER_PARTITION_NOT_AVAILABLE")],
    });
  }

  // 3.如果开启授权应用，检查应用是否已对账户禁用
  if (checkAccountApp && !appId) {
    throw new DetailedError({
      code: Status.PERMISSION_DENIED,
      message: `App ${appId} is not provided when checking app authorization`,
      details: [errorInfo("APP_NOT_PROVIDED")],
    });
  }
  if (checkAccountApp && appId) {
    const isAppDisabledToAccount = await libCheckAppIsDisabled(
      logger,
      clusterId,
      appId,
      accountName,
      config.MIS_SERVER_URL,
      commonConfig.scowApi.auth.token,
      AppScope.HPC,
    );

    if (isAppDisabledToAccount) {
      throw new DetailedError({
        code: Status.PERMISSION_DENIED,
        message: `App ${appId} is disabled to account ${accountName}`,
        details: [errorInfo("APP_NOT_AVAILABLE")],
      });
    }
  }
}
