import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ServiceError } from "@grpc/grpc-js";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { getClusterConfigsTypeFormat } from "@scow/lib-web/build/utils/typeConversion";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { getClient } from "src/utils/client";

export async function getClusterConfigFiles(options?: {
  allowEmpty?: boolean;
}): Promise<Record<string, ClusterConfigSchema>> {
  const client = getClient(ConfigServiceClient);

  try {
    const result = await asyncClientCall(client, "getClusterConfigFiles", {});

    return getClusterConfigsTypeFormat(result.clusterConfigs);
  } catch (error) {
    const serviceError = error as ServiceError;
    const scowErrorCode = serviceError.metadata?.get("SCOW_ERROR_CODE")?.[0]?.toString();

    // Portal 在未配置集群时仍应完成初始化，具体提示交由页面统一展示。
    if (options?.allowEmpty && scowErrorCode === "NO_CLUSTERS") {
      return {};
    }

    throw error;
  }
}
