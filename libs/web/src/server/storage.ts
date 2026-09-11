import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import {
  AccountStorageQuotaState,
  GetUserStorageUsageResponse,
  StorageServiceClient,
} from "@scow/protos/build/server/storage";
import { getClientFn } from "src/utils/api";
import { libWebGetUserInfo } from "src/server/userAccount";

export const libGetUserQuotaUsage = async (
  userId: string,
  storageIds: string[] = [],
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<GetUserStorageUsageResponse> => {
  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };

  const getMisClient = getClientFn(config);
  const client = getMisClient(StorageServiceClient);
  return await asyncClientCall(client, "getUserStorageUsage", { userId, storageIds });
};

export type AccountQuotaUsageMap = Record<string, { quotaMb: number; usedStorageMb: number }>;

export const libGetAccountQuotaUsage = async (
  userId: string,
  storageIds: string[],
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<AccountQuotaUsageMap> => {
  if (!misServerUrl || storageIds.length === 0) {
    return {};
  }

  const getMisClient = getClientFn({
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  });
  const storageClient = getMisClient(StorageServiceClient);

  const { state } = await asyncClientCall(storageClient, "getAccountStorageQuotaState", {})
    .catch(() => ({ state: AccountStorageQuotaState.UNKNOWN, confirmed: false }));

  if (state !== AccountStorageQuotaState.ENABLED) {
    return {};
  }

  const userInfo = await libWebGetUserInfo(userId, misServerUrl, scowApiAuthToken);
  const tenantName = userInfo?.tenantName;
  const accountName = userInfo?.affiliations?.[0]?.accountName;

  if (!tenantName || !accountName) {
    return {};
  }

  const { quotaUsage } = await asyncClientCall(storageClient, "getAccountStorageUsage", {
    tenantName,
    accountName,
    storageIds,
  }).catch(() => ({ quotaUsage: [] }));

  return quotaUsage.reduce<AccountQuotaUsageMap>((result, usage) => {
    result[usage.storageId] = {
      quotaMb: Number(usage.quotaMb),
      usedStorageMb: Number(usage.usedStorageMb),
    };
    return result;
  }, {});
};
