import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { configClusters } from "src/config/clusters";
import { TenantStorageQuota } from "src/entities/TenantStorageQuota";
import { TenantUserStorageQuota } from "src/entities/TenantUserStorageQuota";
import { User } from "src/entities/User";

import { getScowdClient } from "./scowd";

export const checkClusterStorageQuotaEnabled = (clusterConfig: ClusterConfigSchema, paths: string[]) => {
  if (!clusterConfig.storage?.enabled) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: "The storage management function is not enabled. Please check the cluster configuration",
    });
  }

  if (clusterConfig.storage.paths.length === 0) {
    throw new ServiceError({
      code: status.INTERNAL,
      details: "storage.paths cannot be empty, please check the cluster configuration",
    });
  }

  paths.forEach((path) => {
    if (!clusterConfig.storage!.paths.includes(path)) {
      throw new ServiceError({
        code: status.INTERNAL,
        details: `Storage path ${path} does not exist`,
      });
    }
  });

  return;
};

/**
 * 设置新用户的存储配额
 * @param em
 * @param tenantName 新用户所属租户名
 * @param identityId 用户 id
 */
export async function setNewUserStorageQuota(
  em: SqlEntityManager<MySqlDriver>,
  tenantName: string,
  identityId: string,
) {
  // 所有开启了存储配额的集群中均需完成设置
  for (const [cluster, config] of Object.entries(configClusters)) {
    if (config.storage?.enabled && config.scowd?.enabled) {
      const tenantQuotas = await em.find(TenantStorageQuota, { tenant: { name: tenantName } });
      const scowdClient = getScowdClient(cluster);

      const user = await em.findOne(User, { userId: identityId });
      if (!user) {
        throw new ServiceError({
          code: status.INTERNAL,
          details: `User ${identityId} not found`,
        });
      }

      const existingQuota = await em.findOne(TenantUserStorageQuota, {
        cluster,
        user: { userId: identityId },
        path: config.storage.paths[0],
      });
      if (existingQuota) {
        continue;
      }

      const quotaBytes = tenantQuotas.find((quota) => quota.cluster === cluster)?.userDefaultQuota;
      if (quotaBytes === undefined) {
        const totalStorageBytes = (
          await scowdClient.storageQuota.getFilesystemStorageUsage({
            path: config.storage.paths[0],
          })
        ).totalStorageBytes;

        const userQuota = new TenantUserStorageQuota({
          user,
          cluster,
          path: config.storage.paths[0],
          usage: BigInt(0),
        });

        await scowdClient.storageQuota.setUserStorageQuota({
          userId: identityId,
          path: config.storage.paths[0],
          quotaBytes: totalStorageBytes,
        });

        em.persist(userQuota);
      } else {
        const userQuota = new TenantUserStorageQuota({
          user,
          cluster,
          path: config.storage.paths[0],
          usage: BigInt(0),
        });

        await scowdClient.storageQuota.setUserStorageQuota({
          userId: identityId,
          path: config.storage.paths[0],
          quotaBytes: BigInt(quotaBytes),
        });

        em.persist(userQuota);
      }
      await em.flush();
    }
  }
}
