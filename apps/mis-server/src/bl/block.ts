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
import { Loaded } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { ScowResourcesPlugin } from "@scow/lib-scow-resources";
import { BlockedFailedUserAccount } from "@scow/protos/build/server/admin";
import { Account } from "src/entities/Account";
import { UserAccount, UserStatus } from "src/entities/UserAccount";
import { ClusterPlugin } from "src/plugins/clusters";
import { callHook } from "src/plugins/hookClient";

import { getActivatedClusters } from "./clustersUtils";


/**
 * Update block status of accounts and users in the slurm.
 * If it is whitelisted, it doesn't block.
 *
 * @returns  Block successful and failed accounts and users
 **/
export async function updateBlockStatusInSlurm(
  em: SqlEntityManager<MySqlDriver>, clusterPlugin: ClusterPlugin["clusters"], logger: Logger,
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
      await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client) =>

        // 封锁账户时，无论是否部署已授权分区，需要在所有分区下进行封锁
        await asyncClientCall(client.account, "blockAccount", {
          accountName: account.accountName,
          blockedPartitions: [],
        }),
      );
      blockedAccounts.push(account.accountName);
    } catch (error) {
      logger.warn("Failed to block account %s in slurm: %o", account.accountName, error);
      blockedFailedAccounts.push(account.accountName);
    }
  }


  const userAccounts = await em.find(UserAccount, {
    blockedInCluster: UserStatus.BLOCKED,
  }, { populate: ["user", "account"]});

  for (const ua of userAccounts) {
    try {
      await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client) =>
        await asyncClientCall(client.user, "blockUserInAccount", {
          accountName: ua.account.$.accountName,
          userId: ua.user.$.userId,
        }),
      );
      blockedUserAccounts.push([ua.user.getProperty("userId"), ua.account.getProperty("accountName")]);
    } catch (error) {
      logger.warn("Failed to block user accounts (userid: %s, account_name: %s) in slurm: %o",
        ua.user.$.userId, ua.account.$.accountName, error);
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
  em: SqlEntityManager<MySqlDriver>, clusterPlugin: ClusterPlugin["clusters"], logger: Logger,
  scowResourcesPlugin?: ScowResourcesPlugin,
) {
  const accounts = await em.find(Account, {
    $or: [
      { blockedInCluster: false },
      { whitelist: { $ne: null } },
    ],
  });

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
    try {
      await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client, cluster) => {

        const unblockedPartitions = await scowResourcesPlugin?.resources?.getAccountAssignedPartitions({
          accountName: account.accountName,
          tenantName: account.tenant.getProperty("name"),
          clusterId: cluster,
        });

        if (unblockedPartitions && unblockedPartitions.length === 0) {
          logger.info("No partitions assigned to account: %s, the default unblocking operation" +
            " was successfully performed; no additional execution is necessary.",
          account.accountName,
          );
        } else {
          await asyncClientCall(client.account, "unblockAccount", {
            accountName: account.accountName,
            unblockedPartitions: unblockedPartitions ?? [],
          });
        }

      },

      );
      unblockedAccounts.push(account.accountName);
    } catch (error) {
      logger.warn("Failed to unblock account %s in slurm: %o", account.accountName, error);
      unblockedFailedAccounts.push(account.accountName);
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

  if (account.blockedInCluster) { return "AlreadyBlocked"; }

  if (account.whitelist) {
    return "Whitelisted";
  }

  await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client) => {

    // 封锁账户时，无论是否部署已授权分区，需要在所有分区下进行封锁
    await asyncClientCall(client.account, "blockAccount", {
      accountName: account.accountName,
      blockedPartitions: [],
    });
  });

  account.blockedInCluster = true;

  await callHook("accountBlocked", { accountName: account.accountName, tenantName: account.tenant.$.name }, logger);

  return "OK";
}

/**
 * Unblocks the account in the slurm.
 * If it is whitelisted, it doesn't block.
 * Call flush after this.
 *
 * @returns Operation result
**/
export async function unblockAccount(
  account: Loaded<Account, "tenant">,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
  scowResourcesPlugin?: ScowResourcesPlugin,
): Promise<"OK" | "ALREADY_UNBLOCKED"> {

  if (!account.blockedInCluster) { return "ALREADY_UNBLOCKED"; }

  await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client, cluster) => {

    const unblockedPartitions = await scowResourcesPlugin?.resources?.getAccountAssignedPartitions(
      { accountName: account.accountName, tenantName: account.tenant.getProperty("name"), clusterId: cluster },
    );

    if (unblockedPartitions && unblockedPartitions.length === 0) {
      logger.info("No partitions assigned to account: %s, the default unblocking operation" +
        " was successfully performed; no additional execution is necessary.",
      account.accountName,
      );
    } else {
      await asyncClientCall(client.account, "unblockAccount", {
        accountName: account.accountName,
        unblockedPartitions: unblockedPartitions ?? [],
      });
    }

  });

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
  clusterPlugin: ClusterPlugin, logger: Logger,
) {
  if (ua.blockedInCluster == UserStatus.BLOCKED) {
    return;
  }

  const accountName = ua.account.$.accountName;
  const userId = ua.user.$.userId;

  await clusterPlugin.clusters.callOnAll(currentActivatedClusters, logger, async (client) =>
    await asyncClientCall(client.user, "blockUserInAccount", {
      accountName,
      userId,
    }),
  );

  ua.blockedInCluster = UserStatus.BLOCKED;

  await callHook("userBlockedInAccount", {
    accountName,
    userId,
  }, logger);
}

/**
 * Call flush after this.
 * */
export async function unblockUserInAccount(
  ua: Loaded<UserAccount, "user" | "account">,
  currentActivatedClusters: Record<string, ClusterConfigSchema>,
  clusterPlugin: ClusterPlugin, logger: Logger,
) {
  if (ua.blockedInCluster === UserStatus.UNBLOCKED) {
    return;
  }

  const accountName = ua.account.getProperty("accountName");
  const userId = ua.user.getProperty("userId");

  await clusterPlugin.clusters.callOnAll(currentActivatedClusters, logger, async (client) =>
    await asyncClientCall(client.user, "unblockUserInAccount", {
      accountName,
      userId,
    }),
  );

  ua.blockedInCluster = UserStatus.UNBLOCKED;

  await callHook("userUnblockedInAccount", {
    accountName, userId,
  }, logger);
}

