import { ServiceError } from "@ddadaal/tsgrpc-common";
import { status } from "@grpc/grpc-js";
import { ClusterConfigSchema } from "@scow/config/build/cluster";

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
