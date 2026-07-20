import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ScowResourcePlugin } from "@scow/lib-scow-resource";
import { ensureResourceManagementFeatureAvailable } from "@scow/lib-server";
import { Logger } from "pino";
import { ClusterPlugin } from "src/plugins/clusters";

export async function unblockAccountAssignedPartitionsInCluster(
  accountName: string,
  tenantName: string,
  clusterId: string,
  clusterPlugin: ClusterPlugin["clusters"],
  logger: Logger,
  scowResourcePlugin?: ScowResourcePlugin["resource"],
) {
  // 获取当前集群下已授权的分区
  const unblockedPartitions = await scowResourcePlugin?.getAccountAssignedPartitionsForCluster({
    accountName,
    tenantName,
    clusterId,
  });

  if (unblockedPartitions === undefined) {
    throw {
      code: Status.NOT_FOUND,
      message: `Error occured during finding assigned partitions of account: ${accountName}`,
    } as ServiceError;
  }

  await clusterPlugin.callOnOne(clusterId, logger, async (client) => {
    // 检查当前适配器是否具有资源管理可选功能接口，同时判断当前适配器版本
    await ensureResourceManagementFeatureAvailable(client, logger);

    // 获取当前集群信息
    const clusterConfig = await asyncClientCall(client.config, "getClusterConfig", {
      cluster: clusterId,
    });

    // 1.获取当前集群下所有分区
    const partitionNames = clusterConfig.partitions.map((p) => p.name);

    // 2.确认是否存在未授权分区需要再次封锁
    const mayNeedBlockPartitions = partitionNames.filter((p) => !unblockedPartitions.includes(p));
    if (mayNeedBlockPartitions.length > 0) {
      await asyncClientCall(client.account, "blockAccountWithPartitions", {
        accountName,
        blockedPartitions: mayNeedBlockPartitions,
      });
    }

    // 3.执行解封，调用适配器的 unblockAccountWithPartitions
    if (unblockedPartitions.length === 0) {
      logger.info("There is no assigned partitions for account %s to unblock in cluster %s", accountName, clusterId);
    }
    // 空分区也确保调用了unblockAccountWithPartitions，同步账户解封语义到适配器
    await asyncClientCall(client.account, "unblockAccountWithPartitions", {
      accountName,
      unblockedPartitions: unblockedPartitions,
    });
  });
}
