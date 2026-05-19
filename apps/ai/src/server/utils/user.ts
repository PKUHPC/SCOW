import { getCommonConfig } from "@scow/config/src/common";
import { libWebGetUsersByIds } from "@scow/lib-web/build/server/user";
import { GetUsersByIdsResponse_UserInfo } from "@scow/protos/build/server/user";
import { config } from "src/server/config/env";
import { logger } from "src/server/utils/logger";

export async function getUsersName(userIds: string[]): Promise<GetUsersByIdsResponse_UserInfo[]> {
  const commonConfig = getCommonConfig();

  // 如果没有部署管理系统不可用，返回空
  if (!config.MIS_SERVER_URL || userIds.length === 0) {
    logger.info("MIS_SERVER_URL not configured or no userIds provided, skipping user name lookup.");
    return [];
  }

  const results = await libWebGetUsersByIds(userIds, config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);

  if (!results || results.users.length === 0) {
    logger.info("Can not find username for these user Ids.");
    return [];
  }

  return results.users;
}
