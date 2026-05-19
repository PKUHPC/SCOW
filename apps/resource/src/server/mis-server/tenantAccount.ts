import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Account_AccountState, AccountServiceClient, GetAccountsResponse } from "@scow/protos/build/server/account";
import { TenantServiceClient } from "@scow/protos/build/server/tenant";
import { GetTenantsResponse } from "@scow/protos/generated/server/tenant";
import { logger } from "src/utils/logger";
import { USE_MOCK } from "src/utils/processEnv";
import { getScowClient } from "src/utils/scowClient";

// 获取 scow 数据库中的所有租户信息
export async function getScowTenants(): Promise<GetTenantsResponse> {
  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return { names: ["default"] };
  }

  const serverTenantClient = getScowClient(TenantServiceClient);

  const scowTenants = await asyncClientCall(serverTenantClient, "getTenants", {});
  if (!scowTenants || scowTenants.names.length === 0) {
    throw new Error("Can not find tenants.");
  }

  return scowTenants;
}

// 获取 scow 数据库中的所有未删除账户的账户信息
export async function getScowAccounts(tenantName?: string, accountName?: string): Promise<GetAccountsResponse> {
  if (process.env.NODE_ENV === "test" || USE_MOCK) {
    return { results: [] };
  }

  const serverAccountClient = getScowClient(AccountServiceClient);
  const scowAccounts = await asyncClientCall(serverAccountClient, "getAccounts", { tenantName, accountName });
  if (!scowAccounts || scowAccounts.results.length === 0) {
    logger.info("Can not find accounts.");
    return { results: [] };
  }

  const filteredAccountsResult = scowAccounts.results.filter((a) => a.state !== Account_AccountState.DELETED);

  return { results: filteredAccountsResult };
}
