import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { ListAvailableAppsResponse } from "@scow/protos/build/portal/app";
import { AppAuthorizationServiceClient } from "@scow/protos/build/server/app_authorization";

import { getClientFn } from "../api";
import { scowErrorMetadata } from "../error";

export const libGetUserAvailableClusterApps = async (
  logger: Logger,
  clusterId: string,
  userId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<ListAvailableAppsResponse> => {

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(AppAuthorizationServiceClient);

  const reply = await asyncClientCall(client, "getUserAvailableClusterApps", {
    clusterId,
    userId,
  });

  return { apps: reply.apps };
};

// 检查当前应用是否已对传入的账户禁用
export const libCheckAppIsDisabled = async (
  logger: Logger,
  clusterId: string,
  appId: string,
  accountName: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<boolean> => {

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(AppAuthorizationServiceClient);

  const reply = await asyncClientCall(client, "checkAppIsDisabled", {
    clusterId,
    appId,
    accountName,
  });

  return reply.isDisabled;
};


export const NO_AVAILABLE_APPS = "NO_AVAILABLE_APPS";
export const NOT_EXIST_IN_CURRENT_APPS = "NOT_EXIST_IN_CURRENT_APPS";

export const libCheckAppIdInClusterApps
= ({ appId, appIds, clusterId, logger }:
{ appId: string,
  appIds: string[],
  clusterId: string,
  logger: Logger
}) => {

  logger.info("Checking appId in currentClustersApps", appId);
  if (appIds.length === 0) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: `No available apps in current cluster ${clusterId}. Please try again later`,
      metadata: scowErrorMetadata(NO_AVAILABLE_APPS, { currentApps: "" }),
    });
  }

  const exist = appIds.find((x) => (x === appId));
  const appIdsStr = appIds.join(",");
  if (!exist) {
    logger.info("AppId %s is not found in current available apps: %o",
      appId, appIdsStr);
    throw new ServiceError({
      code: status.INTERNAL,
      details: `AppId ${appId} is not found in current available apps
      ${appIdsStr} of cluster ${clusterId}. Please refresh the page and try again`,
      metadata: scowErrorMetadata(NOT_EXIST_IN_CURRENT_APPS,
        { currentApps:
          appIds.length > 0 ? appIdsStr : "" }),
    });
  }

};


