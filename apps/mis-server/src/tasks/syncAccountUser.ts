import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { startAccountUserSynchronization } from "src/bl/syncAccountUser";
import { SystemState } from "src/entities/SystemState";
import { ClusterPlugin } from "src/plugins/clusters";
import { FetchPlugin } from "src/plugins/fetch";

export let lastSyncTime: Date | null = null;

export async function synchronizeAccountUser(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  clusterPlugin: ClusterPlugin,
  scowResourcePlugin?: ScowResourcePlugin,
  operatorId?: string,
  maxSyncDurationMinutes?: number,
  fetchPlugin?: FetchPlugin,
) {
  const sessionId = await startAccountUserSynchronization(
    em,
    clusterPlugin.clusters,
    logger,
    scowResourcePlugin?.resource,
    operatorId,
    maxSyncDurationMinutes,
    fetchPlugin?.fetch,
  );

  lastSyncTime = new Date();

  const updateBlockTime = await em.upsert(SystemState, {
    key: SystemState.KEYS.UPDATE_SLURM_BLOCK_STATUS,
    value: new Date().toISOString(),
  });
  await em.persistAndFlush(updateBlockTime);

  return sessionId;
}
