import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AppAuthorizationServiceClient } from "@scow/protos/build/server/app_authorization";
import { getClientFn } from "src/utils/api";

// 获取应用禁用的账户列表
export const libWebGetAppForbiddenAccounts = async (
  clusterId: string,
  appId: string,
  misServerUrl: string,
  scowApiAuthToken?: string,
): Promise<string[]> => {
  const config = {
    SERVER_URL: misServerUrl,
    SCOW_API_AUTH_TOKEN: scowApiAuthToken,
  };

  const getMisClient = getClientFn(config);
  const client = getMisClient(AppAuthorizationServiceClient);

  try {
    const reply = await asyncClientCall(client, "getAppForbiddenAccounts", {
      clusterId,
      appId,
    });
    return reply.accountNames;
  } catch (e: any) {
    console.error(e.details);
    return [];
  }
};
