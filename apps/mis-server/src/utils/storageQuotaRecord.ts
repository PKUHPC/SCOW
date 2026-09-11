/**
 * 统一通过这个 helper 填充兼容字段，标识`cluster/path`
 * // TODO: 稳定后删除
 */
export const buildStorageQuotaExecutionFields = (
  storageId: string,
  executionCluster: string,
  executionPath: string,
) => {
  return {
    storageId,
    cluster: executionCluster,
    path: executionPath,
  };
};
