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

import { Decimal } from "@scow/lib-decimal";
import { Account_DisplayedAccountState as DisplayedAccountState } from "@scow/protos/build/server/account";
import { AccountUserInfo_DisplayedUserState as DisplayedUserState } from "@scow/protos/build/server/user";
import { AccountState } from "src/entities/Account";
import { UserStateInAccount } from "src/entities/UserAccount";

export interface AccountStateInfo {
  // 当前页面展示的账户状态
  displayedState: DisplayedAccountState,
  // 是否需要在集群中封锁账户
  shouldBlockInCluster: boolean,
}

export interface UserStateInfo {
  // 账户管理的用户列表下展示的用户状态
  displayedState: DisplayedUserState,
  // 是否需要在集群中封锁用户
  shouldBlockInCluster: boolean,
}

/**
 * 根据SCOW数据库保存的信息获取当前页面展示的账户状态
 * @param whitelistId 白名单ID
 * @param state 状态 "NORMAL" || "FROZEN" || "BLOCKED_BY_ADMIN"
 * @param balance 账户余额
 * @param thresholdAmount 封锁阈值 （账户封锁阈值未设置时为租户默认封锁阈值）
 * @returns
 */
export const getAccountStateInfo = (
  whitelistId: number | undefined,
  state: AccountState,
  balance: Decimal,
  thresholdAmount: Decimal): AccountStateInfo => {

  if (state === AccountState.FROZEN) {
    return {
      displayedState: DisplayedAccountState.DISPLAYED_FROZEN,
      shouldBlockInCluster: true,
    };
  }

  if (whitelistId) {
    return {
      displayedState: DisplayedAccountState.DISPLAYED_NORMAL,
      shouldBlockInCluster: false,
    };
  }

  if (state === AccountState.BLOCKED_BY_ADMIN) {
    return {
      displayedState: DisplayedAccountState.DISPLAYED_BLOCKED,
      shouldBlockInCluster: true,
    };
  }

  return balance.lte(thresholdAmount) ?
    {
      displayedState: DisplayedAccountState.DISPLAYED_BELOW_BLOCK_THRESHOLD,
      shouldBlockInCluster: true,
    } : {
      displayedState: DisplayedAccountState.DISPLAYED_NORMAL,
      shouldBlockInCluster: false,
    };
};

/**
 * 根据SCOW数据库保存的信息获取当前页面展示的用户状态
 * @param state 状态 "NORMAL" || "BLOCKED_BY_ADMIN"
 * @param currentLimit 当前限额
 * @param currentUsed 已用额度
 * @returns
 */
export const getUserStateInfo = (
  state: UserStateInAccount | undefined,
  currentLimit: Decimal | undefined,
  currentUsed: Decimal | undefined): UserStateInfo => {

  // 被账户管理员手动封锁时，显示状态为封锁，表示用户不可以使用集群资源
  if (state === UserStateInAccount.BLOCKED_BY_ADMIN) {
    return {
      displayedState: DisplayedUserState.DISPLAYED_BLOCKED,
      shouldBlockInCluster: true,
    };
  }

  // 限额与已用额度存在且不为时，显示状态为封锁，表示用户不可以使用集群资源
  if (currentLimit && currentUsed && currentUsed.gte(currentLimit)) {
    return {
      displayedState: DisplayedUserState.DISPLAYED_QUOTA_EXCEEDED,
      shouldBlockInCluster: true,
    };
  }

  // 状态为正常时，表示用户可以使用集群资源
  return {
    displayedState: DisplayedUserState.DISPLAYED_NORMAL,
    shouldBlockInCluster: false,
  };
};
