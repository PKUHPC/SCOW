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
import { ServiceError } from "@ddadaal/tsgrpc-common";
import { Logger } from "@ddadaal/tsgrpc-server";
import { status } from "@grpc/grpc-js";
import { Loaded } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { BlockedFailedUserAccount } from "@scow/protos/build/server/admin";
import { commonConfig } from "src/config/common";
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

        // 封锁账户时，无论是否部署已授权分区的可选功能，需要在所有分区下进行封锁
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
  scowResourcePlugin?: ScowResourcePlugin["resource"],
) {
  const accounts = await em.find(Account, {
    $or: [
      { blockedInCluster: false },
      { whitelist: { $ne: null } },
    ],
  }, { populate: ["tenant"]});

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

    // 执行解封操作
    // 如果已配置资源管理功能,调用适配器的 unblockAccountWithPartitions
    if (commonConfig.scowResource?.enabled) {
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

        }));
      const errors = results
        .map((result, index) => result.status === "rejected" ?
          { clusterId: Object.keys(currentActivatedClusters)[index], reason: result.reason } : null)
        .filter(Boolean);

      if (errors.length > 0) {

        const errorDetails = errors.map((error) => {
          return `Cluster: ${error?.clusterId}, Reason: ${error?.reason.details || error?.reason}`;
        }).join("; ");
        logger.warn("Failed to unblock account %s in adapter: %o", account.accountName, errorDetails);
        unblockedFailedAccounts.push(account.accountName);
      } else {
        unblockedAccounts.push(account.accountName);
      }

    // 如果未配置资源管理扩展功能， 调用适配器的 unblockAccount
    } else {
      try {
        await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client) => {
          await asyncClientCall(client.account, "unblockAccount", {
            accountName: account.accountName,
          });
        });
        unblockedAccounts.push(account.accountName);
      } catch (error) {
        logger.warn("Failed to unblock account %s in slurm: %o", account.accountName, error);
        unblockedFailedAccounts.push(account.accountName);
      }
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
  scowResourcePlugin?: ScowResourcePlugin["resource"],
): Promise<"OK" | "ALREADY_UNBLOCKED"> {

  if (!account.blockedInCluster) { return "ALREADY_UNBLOCKED"; }

  // 执行解封操作
  // 如果已配置资源管理功能,调用适配器的 unblockAccountWithPartitions
  if (commonConfig.scowResource?.enabled) {

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
      }));

    const errors = results
      .map((result, index) => result.status === "rejected" ?
        { clusterId: Object.keys(currentActivatedClusters)[index], reason: result.reason } : null)
      .filter(Boolean);

    if (errors.length > 0) {

      const errorDetails = errors.map((error) => {
        return `Cluster: ${error?.clusterId}, Reason: ${error?.reason.details || error?.reason}`;
      }).join("; ");
      throw new ServiceError({
        code: status.INTERNAL,
        message: " Unblock account with unblocked partitions failed" ,
        details: errorDetails,
      });
    }


  // 如果未配置资源管理扩展功能， 调用适配器的 unblockAccount
  } else {
    await clusterPlugin.callOnAll(currentActivatedClusters, logger, async (client) => {
      await asyncClientCall(client.account, "unblockAccount", {
        accountName: account.accountName,
      });
    });
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
