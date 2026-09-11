import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getExecutableStorageIds } from "@scow/lib-server";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { Tenant } from "src/entities/Tenant";
import { syncUsersStorageUsage } from "src/utils/syncUsersStorageUsage";

export const lastSyncTime: Record<string, Date | undefined> = {};

// lastSync 以 storageId + tenant 为键。
export const generateKey = (storageId: string, tenant: string) => `${storageId}:${tenant}`;

const setLastSyncTime = async (em: SqlEntityManager<MySqlDriver>, logger: Logger, time: Date) => {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  const tenants = await em.findAll(Tenant, {});
  const storageIds = getExecutableStorageIds(clusterConfigs, activatedClusterIds);

  for (const storageId of storageIds) {
    for (const t of tenants) {
      const key = generateKey(storageId, t.name);
      lastSyncTime[key] = time;
    }
  }
};

export async function syncStorageUsage(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  storageId?: string,
  tenant?: string,
) {
  // 指定 storageId + tenant 时，记录该文件系统下该租户的最近同步时间；
  // 全量同步时，则统一刷新所有可执行文件系统的同步时间。
  if (storageId && tenant) {
    const key = generateKey(storageId, tenant);
    const reply = await syncUsersStorageUsage(em, logger, storageId, tenant);
    lastSyncTime[key] = new Date();
    return reply;
  } else {
    const reply = await syncUsersStorageUsage(em, logger, storageId, tenant);
    await setLastSyncTime(em, logger, new Date());
    return reply;
  }
}
