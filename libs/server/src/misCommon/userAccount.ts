/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Logger } from "@ddadaal/tsgrpc-server";
import { AccountStatusFilter, ListAccountsResponse } from "@scow/protos/build/portal/job";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { GetUserInfoResponse, UserServiceClient, UserStatus } from "@scow/protos/build/server/user";

import { getClientFn } from "../api";

/**
 * 
 * @param logger 
 * @param userId current login user
 * @param misServerUrl mis-server url
 * @param statusFilter AccountStatusFilter | undefined
 * @param scowApiAuthToken 
 * 
 * @returns when the mis-server url does not exist, return []
 * @returns when the statusFilter does not exist or equals to AccountStatusFilter.ALL, returns all accountNames
 * @returns when the statusFilter equals to AccountStatusFilter.BLOCKED_ONLY, returns accountNames that either
 *          the account or the user is blocked in clusters
 * @returns when the statusFilter equals to AccountStatusFilter.UNBLOCKED_ONLY, returns accountNames that both
 *          the account and the user is unblocked in clusters
 */
export const libGetAccounts = async (
  logger: Logger,
  userId: string,
  statusFilter?: AccountStatusFilter,
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<ListAccountsResponse> => {

  if (!misServerUrl) {
    logger.info("Mis is not deployed, can not get accounts from mis.");
    return { accounts: []};
  }

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const accountClient = getMisClient(AccountServiceClient);

  
  const allAccountsInfo = await asyncClientCall(accountClient, "getAccounts", {});
  const allAccounts = allAccountsInfo.results.map((account) => (account.accountName));

  // 如果查询所有账户，则返回所有scow下的账户名列表
  if ((statusFilter === undefined) || statusFilter === AccountStatusFilter.ALL) {
    return { accounts: allAccounts };
  }

  const userClient = getMisClient(UserServiceClient);
  const userInfo = await asyncClientCall(userClient, "getUserInfo", { userId });
  const tenantName = userInfo.tenantName;
  const userAccountsStatues = await asyncClientCall(userClient, "getUserStatus", { userId, tenantName });

  const unblockedAccounts: string[] = [];
  const blockedAccounts: string[] = [];

  Object.entries(userAccountsStatues.accountStatuses).map(([key, value]) => {
    // 当用户关联的账户和用户均未在集群下封锁时，账户为用户的未封锁账户
    if (!value.accountBlocked && value.userStatus === UserStatus.UNBLOCKED) {
      unblockedAccounts.push(key);
    } else {
      blockedAccounts.push(key);
    }
  });

  return { accounts:
    statusFilter === AccountStatusFilter.BLOCKED_ONLY ? blockedAccounts : unblockedAccounts };

};

/**
 * get userInfo from mis db
 */
export const libGetUserInfo = async (
  logger: Logger,
  userId: string,
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<GetUserInfoResponse> => {
  
  if (!misServerUrl) {
    logger.info("Mis is not deployed, can not get accounts from mis.");
    return {} as GetUserInfoResponse;
  }
  
  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(UserServiceClient);  
  return await asyncClientCall(client, "getUserInfo", { userId });
};