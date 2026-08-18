import { Logger } from "@ddadaal/tsgrpc-server";
import { Loaded } from "@mikro-orm/core";
import { SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { Decimal, decimalToMoney } from "@scow/lib-decimal";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { TargetType } from "@scow/notification-protos/build/message_common_pb";
import { blockAccount, blockUserInAccount, unblockAccount, unblockUserInAccount } from "src/bl/block";
import { Account } from "src/entities/Account";
import { ChargeRecord } from "src/entities/ChargeRecord";
import { PayRecord } from "src/entities/PayRecord";
import { Tenant } from "src/entities/Tenant";
import { UserAccount } from "src/entities/UserAccount";
import { InternalMessageType } from "src/models/messageType";
import { ClusterPlugin } from "src/plugins/clusters";
import { callHook } from "src/plugins/hookClient";
import { getAccountStateInfo, getUserStateInfo } from "src/utils/accountUserState";
import { getAccountOwnerAndAdmin } from "src/utils/getAccountOwnerAndAdmin";
import { sendMessage } from "src/utils/sendMessage";
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
  const blockThresholdAmount = account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

  const accountStateInfo = getAccountStateInfo(
    account.whitelist?.id,
    account.state,
    account.balance,
    blockThresholdAmount,
  );

  return accountStateInfo.shouldBlockInCluster;
}

export function checkShouldUnblockAccount(account: Loaded<Account, "tenant">) {
  const blockThresholdAmount = account.blockThresholdAmount ?? account.tenant.$.defaultAccountBlockThreshold;

  const accountStateInfo = getAccountStateInfo(
    account.whitelist?.id,
    account.state,
    account.balance,
    blockThresholdAmount,
  );

  return !accountStateInfo.shouldBlockInCluster;
}

export async function pay(
  request: PayRequest,
  em: SqlEntityManager,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  logger: Logger,
  clusterPlugin: ClusterPlugin,
  scowResourcePlugin: ScowResourcePlugin,
) {
  const { target, amount, comment, operatorId, ipAddress, type } = request;

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
    await callHook(
      "accountPaid",
      {
        accountName: target.accountName,
        amount: decimalToMoney(amount),
        type,
        comment,
      },
      logger,
    );

    // 给账户充值时发送消息
    const ownerAndAdmin = await getAccountOwnerAndAdmin(target.accountName, logger, em);
    await sendMessage(
      {
        messageType: InternalMessageType.AccountRechargeSuccess,
        targetType: TargetType.USER,
        targetIds: ownerAndAdmin.map((x) => x.userId),
        metadata: {
          time: new Date().toISOString(),
          accountName: target.accountName,
          chargeAmount: amount.toString(),
          amount: target.balance.toString(),
        },
      },
      logger,
    );
  } else {
    await callHook("tenantPaid", { tenantName: target.name, amount: decimalToMoney(amount), type, comment }, logger);
  }

  if (target instanceof Account && checkShouldUnblockAccount(target)) {
    logger.info("Unblock account %s", target.accountName);
    await unblockAccount(
      target,
      currentActivatedClusters,
      clusterPlugin.clusters,
      logger,
      scowResourcePlugin.resource,
    );
  }

  if (target instanceof Account && checkShouldBlockAccount(target)) {
    logger.info("Block account %s", target.accountName);
    await blockAccount(target, currentActivatedClusters, clusterPlugin.clusters, logger);
  }

  return {
    currentBalance: target.balance,
    previousBalance: prevBalance,
  };
}

interface ChargeRequest {
  target: Loaded<Account, "tenant"> | Tenant;
  amount: Decimal;
  comment: string;
  type: string;
  userId?: string;
  metadata?: AnyJson;
}

export async function charge(
  request: ChargeRequest,
  em: SqlEntityManager,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  logger: Logger,
  clusterPlugin: ClusterPlugin,
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

  if (target instanceof Account) {
    const ownerAndAdmin = await getAccountOwnerAndAdmin(target.accountName, logger, em);
    await sendMessage(
      {
        messageType: InternalMessageType.AccountBalance,
        targetType: TargetType.USER,
        targetIds: ownerAndAdmin.map((x) => x.userId),
        metadata: {
          accountName: target.accountName,
          amount: amount.toString(),
          balance: target.balance.toString(),
        },
      },
      logger,
    );

    if (target.balance.lt(target.blockThresholdAmount ?? 0)) {
      await sendMessage(
        {
          messageType: InternalMessageType.AccountOverdue,
          targetType: TargetType.USER,
          targetIds: ownerAndAdmin.map((x) => x.userId),
          metadata: {
            time: new Date().toISOString(),
            accountName: target.accountName,
            amount: target.balance
              .minus(target.blockThresholdAmount ?? 0)
              .abs()
              .toString(),
          },
        },
        logger,
      );
    }

    if (target.balance.lt(20)) {
      await sendMessage(
        {
          messageType: InternalMessageType.AccountLowBalance,
          targetType: TargetType.USER,
          targetIds: ownerAndAdmin.map((x) => x.userId),
          metadata: {
            time: new Date().toISOString(),
            accountName: target.accountName,
          },
        },
        logger,
      );
    }
  }

  if (target instanceof Account && checkShouldBlockAccount(target)) {
    logger.info("Block account %s due to out of balance.", target.accountName);
    await blockAccount(target, currentActivatedClusters, clusterPlugin.clusters, logger);
  }

  return {
    currentBalance: target.balance,
    previousBalance: prevBalance,
  };
}

export async function addJobCharge(
  ua: Loaded<UserAccount, "user" | "account">,
  charge: Decimal,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin,
  logger: Logger,
) {
  if (ua.usedJobCharge && ua.jobChargeLimit) {
    ua.usedJobCharge = ua.usedJobCharge.plus(charge);

    const shouldBlockUserInCluster = getUserStateInfo(
      ua.state,
      ua.jobChargeLimit,
      ua.usedJobCharge,
    ).shouldBlockInCluster;

    if (shouldBlockUserInCluster) {
      await blockUserInAccount(ua, currentActivatedClusters, clusterPlugin, logger);
    } else {
      await unblockUserInAccount(ua, currentActivatedClusters, clusterPlugin, logger);
    }
  }
}

export async function setJobCharge(
  ua: Loaded<UserAccount, "user" | "account">,
  charge: Decimal,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin,
  logger: Logger,
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
      await blockUserInAccount(ua, currentActivatedClusters, clusterPlugin, logger);
    } else {
      await unblockUserInAccount(ua, currentActivatedClusters, clusterPlugin, logger);
    }
  }
}
