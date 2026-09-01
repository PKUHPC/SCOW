import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/User";
import { getClient } from "src/utils/client";

export async function accountBelongsToTenant(accountName: string, tenantName: string): Promise<boolean> {
  const client = getClient(AccountServiceClient);
  const { results } = await asyncClientCall(client, "getAccounts", { accountName, tenantName });

  return results.length > 0;
}

export async function canAccessAccountFinance(info: UserInfo, accountName: string): Promise<boolean> {
  if (
    info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
    info.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
    info.accountAffiliations.some((x) => x.accountName === accountName && x.role !== UserRole.USER)
  ) {
    return true;
  }

  if (info.tenantRoles.includes(TenantRole.TENANT_ADMIN) || info.tenantRoles.includes(TenantRole.TENANT_FINANCE)) {
    return await accountBelongsToTenant(accountName, info.tenant);
  }

  return false;
}
