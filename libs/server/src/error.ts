import { MetadataValue } from "@grpc/grpc-js";

export const scowErrorMetadata = (code: string, extra?: Record<string, MetadataValue | MetadataValue[]>) => {
  return {
    IS_SCOW_ERROR: "1",
    SCOW_ERROR_CODE: code,
    ...extra,
  };
};

/** cluster.yaml 中 entryPaths 校验失败 */
export const CLUSTER_CONFIG_VALIDATION_ERROR = "CLUSTER_CONFIG_VALIDATION_ERROR";

/** storage.yaml 内容校验失败（fs 版本不符合要求等） */
export const STORAGE_CONFIG_VALIDATION_ERROR = "STORAGE_CONFIG_VALIDATION_ERROR";
