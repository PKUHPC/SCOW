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

import { Logger } from "@ddadaal/tsgrpc-server";
import { Loaded } from "@mikro-orm/core";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { Decimal, decimalToMoney } from "@scow/lib-decimal";
import { blockAccount, blockUserInAccount, unblockAccount, unblockUserInAccount } from "src/bl/block";
import { Account } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { Tenant } from "src/entities/Tenant";
import { UserAccount } from "src/entities/UserAccount";
import { ClusterPlugin } from "src/plugins/clusters";
import { callHook } from "src/plugins/hookClient";
import { getAccountStateInfo, getUserStateInfo } from "src/utils/accountUserState";
import { AnyJson } from "src/utils/types";

interface PayRequest {
  target: Tenant | Loaded<Account, "tenant">;
  amount: Decimal;
  comment: string;
  type: string;
  ipAddress: string;
  operatorId: string;
}

export function checkShouldBlockAccount(account: Loaded<Account, "tenant">) {

  const blockThresholdAmount =
  account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

  const accountStateInfo =
  getAccountStateInfo(account.whitelist?.id, account.state, account.balance, blockThresholdAmount);

  return accountStateInfo.shouldBlockInCluster;
}

export function checkShouldUnblockAccount(account: Loaded<Account, "tenant">) {

  const blockThresholdAmount =
  account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

  const accountStateInfo =
  getAccountStateInfo(account.whitelist?.id, account.state, account.balance, blockThresholdAmount);

  return !accountStateInfo.shouldBlockInCluster;
}

export async function pay(
  request: PayRequest, em: SqlEntityManager,
  logger: Logger, clusterPlugin: ClusterPlugin,
) {
  const {
    target, amount, comment, operatorId, ipAddress, type,
  } = request;


  const record = new PayRecord({
    time: new Date(),
    target,
    operatorId,
    type,
    comment,
    amount,
    ipAddress,
  });

  em.persist(record);

  const prevBalance = target.balance;
  target.balance = target.balance.plus(amount);

  if (target instanceof Account) {
    await callHook("accountPaid", {
      accountName: target.accountName, amount: decimalToMoney(amount), type, comment }, logger);
  } else {
    await callHook("tenantPaid", { tenantName: target.name, amount: decimalToMoney(amount), type, comment }, logger);
  }

  if (
    target instanceof Account
    && checkShouldUnblockAccount(target)
  ) {
    logger.info("Unblock account %s", target.accountName);
    await unblockAccount(target, clusterPlugin.clusters, logger);
  }

  if (
    target instanceof Account
    && checkShouldBlockAccount(target)
  ) {
    logger.info("Block account %s", target.accountName);
    await blockAccount(target, clusterPlugin.clusters, logger);
  }

  return {
    currentBalance: target.balance,
    previousBalance: prevBalance,
  };
}

type ChargeRequest = {
  target: Loaded<Account, "tenant"> | Tenant;
  amount: Decimal;
  comment: string;
  type: string;
  userId?: string;
  metadata?: AnyJson;
};

export async function charge(
  request: ChargeRequest, em: SqlEntityManager,
  logger: Logger, clusterPlugin: ClusterPlugin,
) {
  const { target, amount, comment, type, userId, metadata } = request;

  const record = new ChargeRecord({
    time: new Date(),
    type,
    target,
    comment,
    amount,
    userId,
    metadata,
  });

  em.persist(record);

  const prevBalance = target.balance;
  target.balance = target.balance.minus(amount);

  if (
    target instanceof Account
    && checkShouldBlockAccount(target)
  ) {
    logger.info("Block account %s due to out of balance.", target.accountName);
    await blockAccount(target, clusterPlugin.clusters, logger);
  }

  return {
    currentBalance: target.balance,
    previousBalance: prevBalance,
  };
}

export async function addJobCharge(
  ua: Loaded<UserAccount, "user" | "account">,
  charge: Decimal, clusterPlugin: ClusterPlugin, logger: Logger,
) {
  if (ua.usedJobCharge && ua.jobChargeLimit) {
    ua.usedJobCharge = ua.usedJobCharge.plus(charge);

    const shouldBlockUserInCluster = getUserStateInfo(
      ua.state,
      ua.jobChargeLimit,
      ua.usedJobCharge,
    ).shouldBlockInCluster;

    if (shouldBlockUserInCluster) {
      await blockUserInAccount(ua, clusterPlugin, logger);
    } else {
      await unblockUserInAccount(ua, clusterPlugin, logger);
    }
  }
}

export async function setJobCharge(
  ua: Loaded<UserAccount, "user" | "account">,
  charge: Decimal, clusterPlugin: ClusterPlugin, logger: Logger,
) {
  ua.jobChargeLimit = charge;
  if (!ua.usedJobCharge) {
    ua.usedJobCharge = new Decimal(0);
  } else {

    const shouldBlockUserInCluster = getUserStateInfo(
      ua.state,
      ua.jobChargeLimit,
      ua.usedJobCharge,
    ).shouldBlockInCluster;

    if (shouldBlockUserInCluster) {
      await blockUserInAccount(ua, clusterPlugin, logger);
    } else {
      await unblockUserInAccount(ua, clusterPlugin, logger);
    }
  }
}
