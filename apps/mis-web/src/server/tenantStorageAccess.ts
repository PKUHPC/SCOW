import { getScowResourceClient } from "@scow/lib-scow-resource";
import { runtimeConfig } from "src/utils/config";
import { hasStorageAccess } from "src/utils/storage";

export async function getTenantStorageAccess(tenantName: string, storageId: string) {
  try {
    const resourceClient = getScowResourceClient(runtimeConfig.SCOW_RESOURCE_CONFIG.address);
    const response = await resourceClient.resource.getTenantAssignedClustersAndPartitions({ tenantName });
    return hasStorageAccess(storageId, Object.keys(response.assignedClusterPartitions))
      ? "allowed" as const
      : "forbidden" as const;
  } catch {
    return "unavailable" as const;
  }
}
