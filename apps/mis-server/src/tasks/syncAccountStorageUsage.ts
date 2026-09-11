import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getExecutableStorageIds } from "@scow/lib-server";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { Tenant } from "src/entities/Tenant";
import { syncAccountsStorageUsage } from "src/utils/syncAccountsStorageUsage";

export const lastAccountSyncTime: Record<string, Date | undefined> = {};

export const generateAccountSyncKey = (storageId: string, tenant: string) => `${storageId}:${tenant}`;

const setLastAccountSyncTime = async (em: SqlEntityManager<MySqlDriver>, logger: Logger, time: Date) => {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  const tenants = await em.findAll(Tenant, {});
  const storageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  for (const storageId of storageIds) {
    for (const t of tenants) {
      const key = generateAccountSyncKey(storageId, t.name);
      lastAccountSyncTime[key] = time;
    }
  }
};

export async function syncAccountStorageUsage(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  storageId?: string,
  tenant?: string,
) {
  if (storageId && tenant) {
    const key = generateAccountSyncKey(storageId, tenant);
    const reply = await syncAccountsStorageUsage(em, logger, storageId, tenant);
    lastAccountSyncTime[key] = new Date();
    return reply;
  } else {
    const reply = await syncAccountsStorageUsage(em, logger, storageId, tenant);
    await setLastAccountSyncTime(em, logger, new Date());
    return reply;
  }
}
