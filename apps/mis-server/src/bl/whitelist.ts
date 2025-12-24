import { Logger } from "@ddadaal/tsgrpc-server";
import { Loaded, LockMode } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { blockAccount } from "src/bl/block";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { Account } from "src/entities/Account";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { ClusterPlugin } from "src/plugins/clusters";
import { getAccountStateInfo } from "src/utils/accountUserState";

export async function processExpiredWhitelist(
  whitelist: Loaded<AccountWhitelist, "account">,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin["clusters"],
) {
  await em.transactional(async (em) => {
    const account = await em.findOne(Account, { id: whitelist.account.id }, {
      populate: ["tenant"],
      lockMode: LockMode.PESSIMISTIC_WRITE,
    });

    if (!account) {
      logger.warn("Account for whitelist %d not found", whitelist.id);
      return;
    }

    // Remove whitelist
    // Use getReference to ensure we are working with an entity managed by the current transactional EM
    const whitelistRef = em.getReference(AccountWhitelist, whitelist.id);
    em.remove(whitelistRef);
    account.whitelist = undefined;

    logger.info("Remove account %s from whitelist due to expiration", account.accountName);

    // Check if account needs to be blocked
    const blockThresholdAmount = account.blockThresholdAmount
      ?? account.tenant.getEntity().defaultAccountBlockThreshold;

    const shouldBlockInCluster = getAccountStateInfo(
      undefined,
      account.state,
      account.balance,
      blockThresholdAmount,
    ).shouldBlockInCluster;

    if (shouldBlockInCluster) {
      logger.info("Account %s is out of balance and not whitelisted. Block the account.", account.accountName);
      const currentActivatedClusters = await getActivatedClusters(em, logger).catch((e) => {
        logger.error("Failed to get activated clusters: %s", e);
        throw e;
      });

      if (Object.keys(currentActivatedClusters).length > 0) {
        try {
          await blockAccount(account as Loaded<Account, "tenant">, currentActivatedClusters, clusterPlugin, logger);
        } catch (e) {
          logger.error("Failed to block account %s: %s", account.accountName, e);
          throw e;
        }
      }
    }
  });
}
