import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { Loaded } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { BlockedFailedUserAccount } from "@scow/protos/build/server/admin";
import { Account } from "src/entities/Account";
import { UserAccount, UserStatus } from "src/entities/UserAccount";
import { ClusterPlugin } from "src/plugins/clusters";
import { callHook } from "src/plugins/hookClient";
import { unblockAccountAssignedPartitionsInCluster } from "src/utils/resourceManagement";

import { getActivatedClusters } from "./clustersUtils";

/**
 * Update block status of accounts and users in the slurm.
 * If it is whitelisted, it doesn't block.
 *
 * @returns  Block successful and failed accounts and users
 **/
export async function updateBlockStatusInSlurm(
  em: SqlEntityManager<MySqlDriver>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
) {
  const blockedAccounts: string[] = [];
  const blockedFailedAccounts: string[] = [];
  const blockedUserAccounts: [string, string][] = [];
  const blockedFailedUserAccounts: BlockedFailedUserAccount[] = [];

  const accounts = await em.find(Account, { blockedInCluster: true });

  const currentActivatedClusters = await getActivatedClusters(em, logger).catch((e) => {
    logger.info(e);
    return {};
  });

  if (Object.keys(currentActivatedClusters).length === 0) {
    logger.info("No available activated clusters in SCOW.");
    return {
      blockedAccounts,
      blockedFailedAccounts,
      blockedUserAccounts,
      blockedFailedUserAccounts,
    };
  }

  for (const account of accounts) {
    if (account.whitelist) {
      continue;
    }
    try {
      await clusterPlugin.callOnAll(
        currentActivatedClusters,
        logger,
        async (client) =>
          // 封锁账户时需要在所有分区下进行封锁
          await asyncClientCall(client.account, "blockAccount", {
            accountName: account.accountName,
          }),
      );
      blockedAccounts.push(account.accountName);
    } catch (error) {
      logger.warn("Failed to block account %s in slurm: %o", account.accountName, error);
      blockedFailedAccounts.push(account.accountName);
    }
  }

  const userAccounts = await em.find(
    UserAccount,
    {
      blockedInCluster: UserStatus.BLOCKED,
    },
    { populate: ["user", "account"] },
  );

  for (const ua of userAccounts) {
    try {
      await clusterPlugin.callOnAll(
        currentActivatedClusters,
        logger,
        async (client) =>
          await asyncClientCall(client.user, "blockUserInAccount", {
            accountName: ua.account.$.accountName,
            userId: ua.user.$.userId,
          }),
      );
      blockedUserAccounts.push([ua.user.getProperty("userId"), ua.account.getProperty("accountName")]);
    } catch (error) {
      logger.warn(
        "Failed to block user accounts (userid: %s, account_name: %s) in slurm: %o",
        ua.user.$.userId,
        ua.account.$.accountName,
        error,
      );
      blockedFailedUserAccounts.push({
        userId: ua.user.$.userId,
        accountName: ua.account.$.accountName,
      });
    }
  }

  logger.info("Updated block status in slurm of the following accounts: %o", blockedAccounts);
  logger.info("Updated block status failed in slurm of the following accounts: %o", blockedFailedAccounts);

  logger.info("Updated block status in slurm of the following user account: %o", blockedUserAccounts);
  logger.info("Updated block status failed in slurm of the following user account: %o", blockedFailedUserAccounts);

  return {
    blockedAccounts,
    blockedFailedAccounts,
    blockedUserAccounts,
    blockedFailedUserAccounts,
  };
}

/**
 * Update unblock status of accounts in the slurm.
 * In order to ensure the stability of the service, serial is selected here.
 *
 * @returns Unblocked Block successful and failed accounts
 **/
export async function updateUnblockStatusInSlurm(
  em: SqlEntityManager<MySqlDriver>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
  scowResourcePlugin: ScowResourcePlugin["resource"],
) {
  const accounts = await em.find(
    Account,
    {
      $or: [{ blockedInCluster: false }, { whitelist: { $ne: null } }],
    },
    { populate: ["tenant"] },
  );

  const unblockedAccounts: string[] = [];
  const unblockedFailedAccounts: string[] = [];

  const currentActivatedClusters = await getActivatedClusters(em, logger).catch((e) => {
    logger.info(e);
    return {};
  });

  if (Object.keys(currentActivatedClusters).length === 0) {
    logger.info("No available activated clusters in SCOW.");
    return {
      unblockedAccounts,
      unblockedFailedAccounts,
    };
  }

  for (const account of accounts) {
    const results = await Promise.allSettled(
      Object.entries(currentActivatedClusters).map(async ([clusterId, _]) => {
        return await unblockAccountAssignedPartitionsInCluster(
          account.accountName,
          account.tenant.getProperty("name"),
          clusterId,
          clusterPlugin,
          logger,
          scowResourcePlugin,
        );
      }),
    );
    const errors = results
      .map((result, index) =>
        result.status === "rejected"
          ? { clusterId: Object.keys(currentActivatedClusters)[index], reason: result.reason }
          : null,
      )
      .filter(Boolean);

    if (errors.length > 0) {
      const errorDetails = errors
        .map((error) => {
          return `Cluster: ${error?.clusterId}, Reason: ${error?.reason.details || error?.reason}`;
        })
        .join("; ");
      logger.warn("Failed to unblock account %s in adapter: %o", account.accountName, errorDetails);
      unblockedFailedAccounts.push(account.accountName);
    } else {
      unblockedAccounts.push(account.accountName);
    }
  }

  logger.info("Updated unblock status in slurm of the following accounts: %o", unblockedAccounts);
  logger.info("Updated unblock status failed in slurm of the following accounts: %o", unblockedFailedAccounts);

  return {
    unblockedAccounts,
    unblockedFailedAccounts,
  };
}

/**
 * Blocks the account in the slurm.
 * If it is whitelisted, it doesn't block.
 * Call flush after this.
 *
 * @returns Operation result
 **/
export async function blockAccount(
  account: Loaded<Account, "tenant">,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
): Promise<"AlreadyBlocked" | "Whitelisted" | "OK"> {
  if (account.blockedInCluster) {
    return "AlreadyBlocked";
  }

  if (account.whitelist) {
    return "Whitelisted";
  }

  await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client) => {
    // 封锁账户时需要在所有分区下进行封锁
    await asyncClientCall(client.account, "blockAccount", {
      accountName: account.accountName,
    });
  });

  account.blockedInCluster = true;

  await callHook("accountBlocked", { accountName: account.accountName, tenantName: account.tenant.$.name }, logger);

  return "OK";
}

/**
 * Unblocks the account or reconciles account assigned partitions in the slurm.
 * If it is whitelisted, it doesn't block
 * Call flush after this.
 *
 * 账户已经解封时默认直接返回 ALREADY_UNBLOCKED，不执行适配器调用、分区收敛或 hook。
 * 需要同步已授权分区时，可通过 reconcileAssignedPartitions 显式开启收敛。
 * 账户处于封锁状态时，按授权分区收敛集群状态，更新状态并发送 hook。
 *
 * @returns Operation result
 **/
export async function unblockAccount(
  account: Loaded<Account, "tenant">,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
  scowResourcePlugin: ScowResourcePlugin["resource"],
  reconcileAssignedPartitions = false,
): Promise<"OK" | "ALREADY_UNBLOCKED"> {
  const wasBlockedInCluster = account.blockedInCluster;

  if (!wasBlockedInCluster && !reconcileAssignedPartitions) {
    return "ALREADY_UNBLOCKED";
  }

  const results = await Promise.allSettled(
    Object.entries(currentActivatedClusters).map(async ([clusterId, _]) => {
      return await unblockAccountAssignedPartitionsInCluster(
        account.accountName,
        account.tenant.getProperty("name"),
        clusterId,
        clusterPlugin,
        logger,
        scowResourcePlugin,
      );
    }),
  );

  const errors = results
    .map((result, index) =>
      result.status === "rejected"
        ? { clusterId: Object.keys(currentActivatedClusters)[index], reason: result.reason }
        : null,
    )
    .filter(Boolean);

  if (errors.length > 0) {
    const errorDetails = errors
      .map((error) => {
        return `Cluster: ${error?.clusterId}, Reason: ${error?.reason.details || error?.reason}`;
      })
      .join("; ");
    throw new ServiceError({
      code: status.INTERNAL,
      message: " Unblock account with unblocked partitions failed",
      details: errorDetails,
    });
  }

  if (!wasBlockedInCluster) {
    return "ALREADY_UNBLOCKED";
  }

  account.blockedInCluster = false;
  await callHook("accountUnblocked", { accountName: account.accountName, tenantName: account.tenant.$.name }, logger);

  return "OK";
}

/**
 * UA's account.accountName and user.userId must be loaded
 * Call flush after this.
 * */
export async function blockUserInAccount(
  ua: Loaded<UserAccount, "user" | "account">,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin,
  logger: Logger,
) {
  if (ua.blockedInCluster == UserStatus.BLOCKED) {
    return;
  }

  const accountName = ua.account.$.accountName;
  const userId = ua.user.$.userId;

  await clusterPlugin.clusters.callOnAll(
    currentActivatedClusters,
    logger,
    async (client) =>
      await asyncClientCall(client.user, "blockUserInAccount", {
        accountName,
        userId,
      }),
  );

  ua.blockedInCluster = UserStatus.BLOCKED;

  await callHook(
    "userBlockedInAccount",
    {
      accountName,
      userId,
    },
    logger,
  );
}

/**
 * Call flush after this.
 * */
export async function unblockUserInAccount(
  ua: Loaded<UserAccount, "user" | "account">,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin,
  logger: Logger,
) {
  if (ua.blockedInCluster === UserStatus.UNBLOCKED) {
    return;
  }

  const accountName = ua.account.getProperty("accountName");
  const userId = ua.user.getProperty("userId");

  await clusterPlugin.clusters.callOnAll(
    currentActivatedClusters,
    logger,
    async (client) =>
      await asyncClientCall(client.user, "unblockUserInAccount", {
        accountName,
        userId,
      }),
  );

  ua.blockedInCluster = UserStatus.UNBLOCKED;

  await callHook(
    "userUnblockedInAccount",
    {
      accountName,
      userId,
    },
    logger,
  );
}
