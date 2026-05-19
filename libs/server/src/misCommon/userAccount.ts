import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Logger } from "@ddadaal/tsgrpc-server";
import { AccountStatusFilter, ListAccountsResponse } from "@scow/protos/build/portal/job";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import {
  GetUserInfoResponse,
  GetUsersByIdsResponse,
  UserServiceClient,
  UserStatus,
} from "@scow/protos/build/server/user";

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
    return { accounts: [] };
  }

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const accountClient = getMisClient(AccountServiceClient);

  const allAccountsInfo = await asyncClientCall(accountClient, "getAccounts", {});
  const allAccounts = allAccountsInfo.results.map((account) => account.accountName);

  // 如果查询所有账户，则返回所有scow下的账户名列表
  if (statusFilter === undefined || statusFilter === AccountStatusFilter.ALL) {
    return { accounts: allAccounts };
  }

  const userClient = getMisClient(UserServiceClient);
  const userInfo = await asyncClientCall(userClient, "getUserInfo", { userId });
  const tenantName = userInfo.tenantName;
  const userAccountsStatues = await asyncClientCall(userClient, "getUserStatus", {
    userId,
    tenantName,
    accountNames: allAccounts,
  });

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

  return { accounts: statusFilter === AccountStatusFilter.BLOCKED_ONLY ? blockedAccounts : unblockedAccounts };
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

/**
 * 通过getUserStatus接口检查用户是否能够正常使用该账户
 * @param logger
 * @param userId
 * @param accountName
 * @param statusFilter AccountStatusFilter | undefined
 * @param misServerUrl mis-server url
 * @param scowApiAuthToken
 *
 * @returns 当mis-server url不存在, 直接返回false
 * @returns 当statusFilter不存在或为UNBLOCKED_ONLY时, 判断账户为该用户的未封锁账户，且用户也未被封锁
 * @returns 当statusFilter为ALL时, 判断账户为该用户的关联账户
 * @returns 当statusFilter为BLOCKED_ONLY时, 判断账户为该用户的关联账户，且账户或者用户被封锁
 */
export const libCheckUserAccountPermission = async (
  logger: Logger,
  userId: string,
  accountName: string,
  statusFilter?: AccountStatusFilter,
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<boolean> => {
  if (!misServerUrl) {
    logger.info("Mis is not deployed, can not get accounts from mis.");
    return false;
  }

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);

  const userClient = getMisClient(UserServiceClient);
  const userInfo = await asyncClientCall(userClient, "getUserInfo", { userId });
  const tenantName = userInfo.tenantName;
  const userAccountsStatues = await asyncClientCall(userClient, "getUserStatus", {
    userId,
    tenantName,
    accountNames: [accountName],
  });

  let unblockedCount = 0;
  let blockedCount = 0;
  let totalCount = 0;

  Object.entries(userAccountsStatues.accountStatuses).map(([key, value]) => {
    if (key !== accountName) {
      return;
    }
    // 当用户关联的账户和用户均未在集群下封锁时，账户为用户的未封锁账户
    if (!value.accountBlocked && value.userStatus === UserStatus.UNBLOCKED) {
      unblockedCount++;
      totalCount++;
    } else {
      blockedCount++;
      totalCount++;
    }
  });

  // 无statusFilter默认为仅查询未封锁
  return statusFilter === AccountStatusFilter.ALL
    ? totalCount === 1
    : statusFilter === AccountStatusFilter.BLOCKED_ONLY
      ? blockedCount === 1
      : unblockedCount === 1;
};

/**
 * get users from mis db
 */
export const libGetUsersByIds = async (
  userIds: string[],
  misServerUrl?: string,
  scowApiAuthToken?: string,
): Promise<GetUsersByIdsResponse> => {
  if (!misServerUrl) {
    throw new Error("Mis is not deployed, can not get accounts from mis.");
  }

  const getMisClient = getClientFn(misServerUrl, scowApiAuthToken);
  const client = getMisClient(UserServiceClient);
  return await asyncClientCall(client, "getUsersByIds", { userIds });
};
