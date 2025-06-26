import { Logger } from "@ddadaal/tsgrpc-server";
import { Server } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { checkSchedulerApiVersion } from "@scow/lib-server";
import { NodeInfo_NodeState } from "@scow/protos/build/common/config";
import { ApiVersion } from "@scow/utils/build/version";
import { misConfig } from "src/config/mis";

// 检查节点迁移的misConfig配置
export const validateMigratableClustersConfig = () => {

  if (!misConfig.nodeMigration?.enabled) {
    throw {
      code: status.FAILED_PRECONDITION,
      message: "Node migration configuration is not enabled.",
    } as ServiceError;
  }
  const { migratableClusterGroups } = misConfig.nodeMigration;

  const isValidConfig = migratableClusterGroups &&
  migratableClusterGroups.length > 0 &&
  migratableClusterGroups.every((c) => c.group?.length > 1);

  if (!isValidConfig) {
    throw {
      code: status.FAILED_PRECONDITION,
      message: "Node migration configuration is not properly configured for the group.",
    } as ServiceError;
  }
  return migratableClusterGroups;
};

// 获得目标集群的关联集群
interface MigratableClusterGroups {
  group: string[];
}

export const getUniqueMigrationGroups =
 (migratableClusterGroups: MigratableClusterGroups[], cluster: string): string[] => {
   const clusterGroups = migratableClusterGroups.reduce((acc, curr) => {
     if (curr.group?.includes(cluster)) { // 空值安全判断
       curr.group.forEach((g) => g !== cluster && acc.add(g)); // 直接操作Set去重
     }
     return acc;
   }, new Set<string>());

   return Array.from(clusterGroups);
 };

export interface NodeClusterStatus {
  cluster: string; // 节点所属的集群
  state: NodeInfo_NodeState; // 节点状态
  removable: boolean; // 是否有作业在运行
}

export interface NodeClusterStatusWithPartitions extends NodeClusterStatus {
  partitions: string[]; // 分区信息
}

interface ClusterCheckResult {
  clusterErrors: string[];
  versionErrors: string[];
}

interface ClusterCheckOptions {
  clusters: string[];
  minVersion: ApiVersion;
  operationName: string;
}

// 执行集群健康检查并分类错误
export async function performClusterChecks(
  options: ClusterCheckOptions,
  logger: Logger,
  server: Server,
): Promise<ClusterCheckResult> {
  const { clusters, minVersion, operationName } = options;
  const clusterErrors: string[] = [];
  const versionErrors: string[] = [];

  // 执行集群检查
  const results = await Promise.allSettled(
    clusters.map(async (cluster) => {
      try {
        await server.ext.clusters.callOnOne(
          cluster,
          logger,
          async (client) => {
            // 当前接口要求的最低调度器接口版本
            // 检查调度器的 API 版本
            await checkSchedulerApiVersion(client, minVersion);
          },
        );
      } catch (err) {
        handleClusterError(err, cluster, clusterErrors, versionErrors);
        throw err; // 保持错误传播
      }
    }),
  );

  // 处理检查结果
  processCheckResults(results, clusters, clusterErrors, versionErrors, logger);

  if (clusterErrors.length > 0) {
    logger.error(`${operationName} cluster errors on clusters: ${clusterErrors.join(", ")}`);
  }
  if (versionErrors.length > 0) {
    logger.error(`${operationName} scheduler version errors on clusters: ${versionErrors.join(", ")}`);
  }

  return { clusterErrors, versionErrors };
}

// 记录不存在集群和适配器版本错误
function handleClusterError(
  error: unknown,
  cluster: string,
  clusterErrors: string[],
  versionErrors: string[],
) {
  const serviceError = error as ServiceError;
  const errorMessage = [serviceError.message, serviceError.details]
    .join(" ")
    .toLowerCase();

  if (errorMessage.includes("calling actions on non-existing cluster")) {
    clusterErrors.push(cluster);
  } else if (errorMessage.includes("scheduler adapter must be upgraded")) {
    versionErrors.push(cluster);
  }
}

/**
 * 处理未分类错误
 */
function processCheckResults(
  results: PromiseSettledResult<void>[],
  clusters: string[],
  clusterErrors: string[],
  versionErrors: string[],
  logger: Logger,
) {
  results.forEach((result, index) => {
    const cluster = clusters[index];
    if (result.status === "rejected") {
      const error = result.reason as ServiceError;

      // 处理未分类错误
      if (!clusterErrors.includes(cluster) && !versionErrors.includes(cluster)) {
        logger.error(`Unclassified error checking cluster ${cluster}`, error);
        throw {
          code: status.INTERNAL,
          message: `Cluster check failed for ${cluster}`,
          details: error.message,
        } as ServiceError;
      }
    }
  });
}


interface ErrorParams {
  clusterErrors: string[];
  versionErrors: string[];
  minVersion: ApiVersion;
  logger: Logger;
}

// 处理错误信息并报错
export function handleValidationErrors(params: ErrorParams): void {
  const { clusterErrors, versionErrors, minVersion, logger } = params;
  const errorMessages: string[] = [];

  // 构造可读的错误信息
  if (clusterErrors.length > 0) {
    errorMessages.push(`Clusters ${clusterErrors.join(", ")} do not exist`);
  }
  if (versionErrors.length > 0) {
    errorMessages.push(
      `Clusters ${versionErrors.join(", ")} require scheduler adapter upgrade to ` +
      `${minVersion.major}.${minVersion.minor}.${minVersion.patch} or higher`,
    );
  }

  // 合并错误信息
  const combinedMessage = errorMessages.join(" and ");

  if (errorMessages.length > 0) {
    logger.error("Cluster validation failed", combinedMessage);

    throw {
      code: clusterErrors.length ? status.NOT_FOUND : status.FAILED_PRECONDITION,
      message: combinedMessage,
    } as ServiceError;
  }

}
