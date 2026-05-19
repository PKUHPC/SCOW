import { Logger } from "@ddadaal/tsgrpc-server";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { Tenant } from "src/entities/Tenant";
import { syncUsersStorageUsage } from "src/utils/syncUsersStorageUsage";

// 修改 lastSyncTime 的类型，使用三元组作为键
export const lastSyncTime: Record<string, Date | undefined> = {};

// 生成唯一的键，格式为 "cluster:path:tenant"
export const generateKey = (c: string, p: string, t: string) => `${c}:${p}:${t}`;

const setLastSyncTime = async (em: SqlEntityManager<MySqlDriver>, logger: Logger, time: Date) => {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const clusterNames = Object.keys(currentActivatedClusters);
  const tenants = await em.findAll(Tenant, {});

  // Process all clusters
  for (const cluster of clusterNames) {
    const storagePaths = clusterConfigs[cluster].storage?.paths;

    if (!clusterConfigs[cluster].storage?.enabled || !storagePaths || storagePaths.length === 0) {
      continue;
    }

    // Process each storage path
    for (const path of storagePaths) {
      for (const t of tenants) {
        const key = generateKey(cluster, path, t.name);
        lastSyncTime[key] = time;
      }
    }
  }
};
export async function syncStorageUsage(
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  cluster?: string,
  path?: string,
  tenant?: string,
) {
  // 如果调用时指定了 cluster, path 和 tenant，使用指定的值生成 key
  // 否则可能需要遍历所有可能的组合
  if (cluster && path && tenant) {
    const key = generateKey(cluster, path, tenant);
    const reply = await syncUsersStorageUsage(em, logger, cluster, path, tenant);
    lastSyncTime[key] = new Date();
    return reply;
  } else {
    const reply = await syncUsersStorageUsage(em, logger, cluster, path, tenant);
    await setLastSyncTime(em, logger, new Date());
    return reply;
  }
}
