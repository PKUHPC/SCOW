import { Logger } from "@ddadaal/tsgrpc-server";
import { Loaded } from "@mikro-orm/core";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { processExpiredWhitelist } from "src/bl/whitelist";
import { AccountUserSyncRecord, SyncStatus } from "src/entities/AccountUserSyncRecord";
import { AccountWhitelist } from "src/entities/AccountWhitelist";
import { ClusterPlugin } from "src/plugins/clusters";
import { checkRunningSyncTask, updateStuckRunningSync } from "src/utils/synchronizationUtils";

export async function cleanExpiredWhitelists(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin["clusters"],
) {

  // Check running sync task
  const startTime = Date.now();
  const maxWaitTime = 10 * 60 * 1000; // 10 minutes

  while (await checkRunningSyncTask(em, logger)) {
    if (Date.now() - startTime > maxWaitTime) {
      logger.warn("Sync task is running for too long (over 10 minutes),"
        + " stop sync task and proceed to cleanExpiredWhitelists task.");
      // Find and stop the running sync task
      const runningSyncRecord = await em.findOne(AccountUserSyncRecord, {
        syncStatus: SyncStatus.RUNNING,
      });
      if (runningSyncRecord) {
        // Force update the sync record to failed
        logger.warn("Stopped running sync task %s due to timeout (10 minutes)", runningSyncRecord.sessionId);
        await updateStuckRunningSync(em, logger, runningSyncRecord as Loaded<AccountUserSyncRecord>);
      }
      break;
    }
    logger.info("Sync task is running, waiting for 1 minute...");
    await new Promise((r) => setTimeout(r, 60000));
  }

  const today = new Date();

  // Find expired whitelists
  const expiredWhitelists = await em.find(AccountWhitelist, {
    expirationTime: { $lte: today },
  }, { populate: ["account"]});

  if (expiredWhitelists.length === 0) {
    return;
  }

  logger.info("Found %d expired whitelists", expiredWhitelists.length);

  const hasErrorAccounts: string[] = [];
  for (const whitelist of expiredWhitelists) {
    try {
      await processExpiredWhitelist(whitelist, em, logger, clusterPlugin);
    } catch {
      hasErrorAccounts.push(whitelist.account.$.accountName);
    }
  }

  if (hasErrorAccounts.length > 0) {
    logger.error("Clean expired whitelists task finished with %d errors for accounts: %s",
      hasErrorAccounts.length, hasErrorAccounts.join(", "));
  }
}
