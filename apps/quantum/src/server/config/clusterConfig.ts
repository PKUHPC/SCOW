import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { ClusterConfigSchema } from "@scow/config/build/cluster";
import { getClusterConfigsTypeFormat } from "@scow/lib-web/build/utils/typeConversion";
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { getPortalClient } from "src/utils/client";

export async function getClusterConfigFiles(): Promise<Record<string, ClusterConfigSchema>> {
  const client = getPortalClient(ConfigServiceClient);

  const result = await asyncClientCall(client, "getClusterConfigFiles", {});

  const modifiedClusters: Record<string, ClusterConfigSchema> = getClusterConfigsTypeFormat(result.clusterConfigs);

  return modifiedClusters;
}
