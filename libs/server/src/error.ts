import { MetadataValue } from "@grpc/grpc-js";

export const scowErrorMetadata = (code: string, extra?: Record<string, MetadataValue | MetadataValue[]>) => {
  return {
    IS_SCOW_ERROR: "1",
    SCOW_ERROR_CODE: code,
    ...extra,
  };
};
