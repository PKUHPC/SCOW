import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { GetUserStorageUsageResponse, StorageServiceClient } from "@scow/protos/build/server/storage";
import { getClientFn } from "src/utils/api";

export const libGetUserQuotaUsage = async (
  userId: string,
  cluster: string,
  paths: string[],
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<GetUserStorageUsageResponse> => {

  if (!misServerUrl) {
    console.log("Mis is not deployed, can not get userInfo from mis.");
    return { quotaUsage: []} as GetUserStorageUsageResponse;
  }

  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };

  const getMisClient = getClientFn(config);
  const client = getMisClient(StorageServiceClient);
  return await asyncClientCall(client, "getUserStorageUsage", { userId, cluster, paths });
};
