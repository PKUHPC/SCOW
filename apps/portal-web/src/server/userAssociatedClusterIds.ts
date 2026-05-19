import { ScowResourceConfigSchema } from "@scow/config/build/common";
import { getUserAccountsClusterIds } from "@scow/lib-scow-resource";

export async function getUserAssociatedClusterIds(
  userAccounts: string[],
  tenantName: string,
  scowResourceConfig: ScowResourceConfigSchema,
): Promise<string[] | undefined> {
  const associatedClusterIds = await getUserAccountsClusterIds(scowResourceConfig, userAccounts, tenantName);

  return associatedClusterIds;
}
