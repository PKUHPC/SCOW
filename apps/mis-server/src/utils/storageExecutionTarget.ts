import { Logger } from "@ddadaal/tsgrpc-server";
import { ServiceError, status } from "@grpc/grpc-js";
import { MySqlDriver, SqlEntityManager } from "@mikro-orm/mysql";
import { getClusterConfigs } from "@scow/config/build/cluster";
import { getStorageMountRefs } from "@scow/lib-server";
import { getActivatedClusters } from "src/bl/clustersUtils";
import { misConfig } from "src/config/mis";

interface StorageExecutionTargetContext {
  clusterConfigs: ReturnType<typeof getClusterConfigs>;
  activatedClusterIds: Set<string>;
}

export interface StorageExecutionTarget {
  executionCluster: string;
  executionPath: string;
  executionStorage: ReturnType<typeof getStorageMountRefs>[number];
}

// 单个 scowd 集群无响应时及时切换；每个候选集群都获得完整的尝试时间。
// 未配置时使用默认 10 秒；仅调用方显式 disableTimeout 才关闭超时。
export const STORAGE_OPERATION_ATTEMPT_TIMEOUT_MS = (misConfig.storageOperationTimeoutSeconds ?? 10) * 1000;

export interface StorageOperationTimeoutOptions {
  /** 批量/同步任务暂时不进行超时处理，等待后续批量处理整体优化。 */
  disableTimeout?: boolean;
  attemptTimeoutMs?: number;
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject({
      code: status.DEADLINE_EXCEEDED,
      message,
    } as ServiceError), timeoutMs);
  });

  // Promise.race 只限制等待时间；operation 本身没有取消参数，底层请求可能仍在执行。
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// 把按文件系统操作落地成按具体挂载点执行。
// 一个 storageId 可能挂在多个集群上，但单次 SCOWD 调用只能选一个执行目标。
// 因此这里返回的是 executionCluster / executionPath，而不是所有挂载点，这里用于处理任意一个挂载点都能完成的请求。
export const resolveStorageExecutionTargetWithContext = (
  storageId: string,
  context: StorageExecutionTargetContext,
  logger: Logger,
) => {
  const { mountedClusters, executionTargets } = resolveStorageExecutionTargetsWithContext(storageId, context, logger);
  const executableRef = executionTargets[0];

  return {
    mountedClusters,
    ...executableRef,
  };
};

/**
 * 返回同一存储在所有启用中集群上的执行目标，供调用方在 scowd 故障时依次重试。
 */
export const resolveStorageExecutionTargetsWithContext = (
  storageId: string,
  context: StorageExecutionTargetContext,
  logger: Logger,
) => {
  const { clusterConfigs, activatedClusterIds } = context;

  const mountedRefs = getStorageMountRefs(clusterConfigs, storageId).filter(
    (ref) => ref.storage.quotaEnabled,
  );

  if (mountedRefs.length === 0) {
    logger.warn("Storage is not mounted or quota is disabled", { storageId });
    throw {
      code: status.NOT_FOUND,
      message: `Storage ${storageId} is not found or quota is not enabled.`,
    } as ServiceError;
  }

  const executableRefs = mountedRefs.filter((ref) => activatedClusterIds.has(ref.clusterId));

  if (executableRefs.length === 0) {
    logger.warn("Storage has no executable mounted cluster", {
      storageId,
      mountedClusterIds: mountedRefs.map((ref) => ref.clusterId),
      activatedClusterIds: Array.from(activatedClusterIds),
    });
    throw {
      code: status.FAILED_PRECONDITION,
      message: `Storage ${storageId} has no executable mounted cluster.`,
    } as ServiceError;
  }

  return {
    mountedClusters: mountedRefs.map((ref) => ref.clusterId),
    executionTargets: executableRefs.map((ref) => ({
      executionCluster: ref.clusterId,
      executionPath: ref.mountPath,
      executionStorage: ref,
    })),
  };
};

export const executeStorageOperationWithFailoverWithContext = async <T>(
  storageId: string,
  context: StorageExecutionTargetContext,
  logger: Logger,
  operation: (target: StorageExecutionTarget) => Promise<T>,
  timeoutOptions: StorageOperationTimeoutOptions = {},
) => {
  const { mountedClusters, executionTargets } = resolveStorageExecutionTargetsWithContext(storageId, context, logger);
  let lastError: unknown;
  const attemptErrors: { cluster: string; path: string; error: unknown }[] = [];
  const attemptTimeoutMs = timeoutOptions.attemptTimeoutMs ?? STORAGE_OPERATION_ATTEMPT_TIMEOUT_MS;

  for (const target of executionTargets) {
    try {
      const result = timeoutOptions.disableTimeout || attemptTimeoutMs === undefined
        ? await operation(target)
        : await withTimeout(
            operation(target),
            attemptTimeoutMs,
            `Storage quota operation on cluster ${target.executionCluster} timed out.`,
          );
      return { ...target, mountedClusters, result };
    } catch (error) {
      lastError = error;
      attemptErrors.push({
        cluster: target.executionCluster,
        path: target.executionPath,
        error,
      });
      logger.warn(
        {
          err: error,
          storageId,
          cluster: target.executionCluster,
          path: target.executionPath,
        },
        "Storage quota operation failed; trying the next activated mounted cluster",
      );
    }
  }

  // 对外仍抛出最后一次调用的错误；汇总日志用于串联同一存储的完整故障转移过程。
  logger.error(
    {
      storageId,
      attemptedCount: attemptErrors.length,
      attemptedClusters: attemptErrors.map(({ cluster }) => cluster),
      attemptErrors: attemptErrors.map(({ cluster, path, error }) => ({
        cluster,
        path,
        error: error instanceof Error
          ? { name: error.name, message: error.message }
          : error,
      })),
    },
    "Storage quota operation failed on all activated mounted clusters",
  );

  throw lastError;
};

export const resolveStorageExecutionTarget = async (
  storageId: string,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
) => {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  return resolveStorageExecutionTargetWithContext(
    storageId,
    { clusterConfigs, activatedClusterIds },
    logger,
  );
};

export const executeStorageOperationWithFailover = async <T>(
  storageId: string,
  em: SqlEntityManager<MySqlDriver>,
  logger: Logger,
  operation: (target: StorageExecutionTarget) => Promise<T>,
  timeoutOptions: StorageOperationTimeoutOptions = {},
) => {
  const currentActivatedClusters = await getActivatedClusters(em, logger);
  const clusterConfigs = getClusterConfigs(undefined, logger);
  const activatedClusterIds = new Set(Object.keys(currentActivatedClusters));
  return executeStorageOperationWithFailoverWithContext(
    storageId,
    { clusterConfigs, activatedClusterIds },
    logger,
    operation,
    timeoutOptions,
  );
};
