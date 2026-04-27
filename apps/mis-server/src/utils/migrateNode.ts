import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Logger } from "@ddadaal/tsgrpc-server";
import { Server } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { NodeInfo_NodeState } from "@scow/protos/build/common/config";
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

export const normalizeNodeName = (nodeName: string): string => nodeName.toLowerCase();

interface ClusterCheckResult {
  clusterErrors: string[];
}

interface ClusterCheckOptions {
  clusters: string[];
  operationName: string;
}

// 执行集群健康检查并分类错误
export async function performClusterChecks(
  options: ClusterCheckOptions,
  logger: Logger,
  server: Server,
): Promise<ClusterCheckResult> {
  const { clusters, operationName } = options;
  const clusterErrors: string[] = [];

  // 执行集群检查
  const results = await Promise.allSettled(
    clusters.map(async (cluster) => {
      try {
        await server.ext.clusters.callOnOne(
          cluster,
          logger,
          async (client) => {
            return await asyncClientCall(client.config, "getClusterNodesInfo", {
              nodeNames: [],
            });
          },
        );
      } catch (err) {
        handleClusterError(err, cluster, clusterErrors);
        throw err; // 保持错误传播
      }
    }),
  );

  // 处理检查结果
  processCheckResults(results, clusters, clusterErrors, logger);

  if (clusterErrors.length > 0) {
    logger.error(`${operationName} cluster errors on clusters: ${clusterErrors.join(", ")}`);
  }

  return { clusterErrors };
}

// 记录不存在集群和适配器版本错误
function handleClusterError(
  error: unknown,
  cluster: string,
  clusterErrors: string[],
) {
  const serviceError = error as ServiceError;
  const errorMessage = [serviceError.message, serviceError.details]
    .join(" ")
    .toLowerCase();

  if (errorMessage.includes("calling actions on non-existing cluster")) {
    clusterErrors.push(cluster);
  }
}

/**
 * 处理未分类错误
 */
function processCheckResults(
  results: PromiseSettledResult<void>[],
  clusters: string[],
  clusterErrors: string[],
  logger: Logger,
) {
  results.forEach((result, index) => {
    const cluster = clusters[index];
    if (result.status === "rejected") {
      const error = result.reason as ServiceError;

      // 处理未分类错误
      if (!clusterErrors.includes(cluster)) {
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
  logger: Logger;
}

// 处理错误信息并报错
export function handleValidationErrors(params: ErrorParams): void {
  const { clusterErrors, logger } = params;
  const errorMessages: string[] = [];

  // 构造可读的错误信息
  if (clusterErrors.length > 0) {
    errorMessages.push(`Clusters ${clusterErrors.join(", ")} do not exist`);
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
