import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { updateBlockStatusInSlurm, updateUnblockStatusInSlurm } from "src/bl/block";
import { SystemState } from "src/entities/SystemState";
import { ClusterPlugin } from "src/plugins/clusters";

export let lastSyncTime: Date | null = null;

export async function synchronizeBlockStatus(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin,
  scowResourcePlugin: ScowResourcePlugin,
) {
  const { blockedFailedAccounts, blockedFailedUserAccounts } = await updateBlockStatusInSlurm(
    em,
    clusterPlugin.clusters,
    logger,
  );
  const { unblockedFailedAccounts } = await updateUnblockStatusInSlurm(
    em,
    clusterPlugin.clusters,
    logger,
    scowResourcePlugin.resource,
  );

  lastSyncTime = new Date();

  const updateBlockTime = await em.upsert(SystemState, {
    key: SystemState.KEYS.UPDATE_SLURM_BLOCK_STATUS,
    value: new Date().toISOString(),
  });
  await em.persistAndFlush(updateBlockTime);
  return { blockedFailedAccounts, blockedFailedUserAccounts, unblockedFailedAccounts };
}
