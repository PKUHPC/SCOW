import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { getUserAssociatedClusterIds } from "src/server/userAssociatedClusterIds";

import { publicConfig, runtimeConfig } from "./config";

export async function checkUserAssignedClusters(clusterIds: string[] | string, userId: string): Promise<boolean> {
  // 如果没有部署管理系统或没有部署资源管理系统。跳过此检查
  if (!publicConfig.MIS_DEPLOYED || !runtimeConfig.SCOW_RESOURCE_CONFIG) {
    return true;
  }

  const idsToCheck = Array.isArray(clusterIds) ? clusterIds : [clusterIds];

  const userInfo = await libWebGetUserInfo(userId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN);

  const accountNames = userInfo?.affiliations.map((a) => a.accountName);
  const tenantName = userInfo?.tenantName;

  if (!accountNames || !tenantName) {
    console.warn(`Can not get user's ${userId} tenant name or account names.`);
    return false;
  }

  const userAssignedClusterIds = await getUserAssociatedClusterIds(
    accountNames,
    tenantName,
    runtimeConfig.SCOW_RESOURCE_CONFIG,
  );

  const exist = idsToCheck.every((id) => userAssignedClusterIds?.find((x) => x === id));

  return exist;
}
