import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import {
  AppScope,
  AppAuthorizationServiceClient,
  GetUserAvailableClusterAppsResponse,
} from "@scow/protos/build/server/app_authorization";

import { getClientFn } from "../api";
import { scowErrorMetadata } from "../error";

export { AppScope };

export const libGetUserAvailableClusterApps = async (
  logger: Logger,
  clusterId: string,
  userId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
  appScope?: AppScope,
): Promise<GetUserAvailableClusterAppsResponse> => {
  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(AppAuthorizationServiceClient);

  return await asyncClientCall(client, "getUserAvailableClusterApps", {
    clusterId,
    userId,
    appScope,
  });
};

// 获取用户所有集群中所有可用的App
export const libGetUserAvailableApps = async (
  logger: Logger,
  clusterIds: string[],
  userId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
  appScope?: AppScope,
): Promise<GetUserAvailableClusterAppsResponse> => {
  if (clusterIds.length === 0) {
    logger.info("No clusters provided when querying available apps for user %s.", userId);
    return { apps: [] };
  }

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(AppAuthorizationServiceClient);

  type AvailableApp = NonNullable<GetUserAvailableClusterAppsResponse["apps"]>[number];
  const appMap = new Map<string, AvailableApp>();

  for (const clusterId of clusterIds) {
    try {
      const reply = await asyncClientCall(client, "getUserAvailableClusterApps", {
        clusterId,
        userId,
        appScope,
      });

      reply.apps?.forEach((app) => {
        if (!appMap.has(app.id)) {
          appMap.set(app.id, app);
        }
      });
    } catch (e) {
      const serviceError = e as ServiceError;
      if (serviceError.code === status.NOT_FOUND) {
        logger.warn(
          e,
          "MIS returned NOT_FOUND when listing apps for user %s in cluster %s, skipping this cluster.",
          userId,
          clusterId,
        );
        continue;
      }

      logger.error(e, "Failed to get available apps for user %s in cluster %s.", userId, clusterId);
      throw e;
    }
  }

  return { apps: Array.from(appMap.values()) };
};

// 检查当前应用是否已对传入的账户禁用
export const libCheckAppIsDisabled = async (
  logger: Logger,
  clusterId: string,
  appId: string,
  accountName: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
  appScope?: AppScope,
): Promise<boolean> => {
  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(AppAuthorizationServiceClient);

  const reply = await asyncClientCall(client, "checkAppIsDisabled", {
    clusterId,
    appId,
    accountName,
    appScope,
  });

  return reply.isDisabled;
};

export const NO_AVAILABLE_APPS = "NO_AVAILABLE_APPS";
export const NOT_EXIST_IN_CURRENT_APPS = "NOT_EXIST_IN_CURRENT_APPS";

export const libCheckAppIdInClusterApps = ({
  appId,
  appIds,
  clusterId,
  logger,
}: {
  appId: string;
  appIds: string[];
  clusterId: string;
  logger: Logger;
}) => {
  logger.info("Checking appId in currentClustersApps", appId);
  if (appIds.length === 0) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: `No available apps in current cluster ${clusterId}. Please try again later`,
      metadata: scowErrorMetadata(NO_AVAILABLE_APPS, { currentApps: "" }),
    });
  }

  const exist = appIds.find((x) => x === appId);
  const appIdsStr = appIds.join(",");
  if (!exist) {
    logger.info("AppId %s is not found in current available apps: %o", appId, appIdsStr);
    throw new ServiceError({
      code: status.INTERNAL,
      details: `AppId ${appId} is not found in current available apps
      ${appIdsStr} of cluster ${clusterId}. Please refresh the page and try again`,
      metadata: scowErrorMetadata(NOT_EXIST_IN_CURRENT_APPS, { currentApps: appIds.length > 0 ? appIdsStr : "" }),
    });
  }
};

// 获取应用禁用的账户列表
export const libGetAppForbiddenAccounts = async (
  clusterId: string,
  appId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
  appScope?: AppScope,
): Promise<string[]> => {
  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(AppAuthorizationServiceClient);

  // 后端报错会正常抛出
  const reply = await asyncClientCall(client, "getAppForbiddenAccounts", {
    clusterId,
    appId,
    appScope,
  });
  return reply.accountNames;
};
