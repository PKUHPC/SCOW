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
    return { names: ["default"]};
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
    return { results: []};
  }

  const serverAccountClient = getScowClient(AccountServiceClient);
  const scowAccounts = await asyncClientCall(serverAccountClient, "getAccounts", { tenantName, accountName });
  if (!scowAccounts || scowAccounts.results.length === 0) {
    logger.info("Can not find accounts.");
    return { results: []};
  }

  const filteredAccountsResult = scowAccounts.results.filter((a) => a.state !== Account_AccountState.DELETED);

  return { results: filteredAccountsResult };

}

// // 获取 scow 的账户在集群中的可用分区
// export async function getAccountAvailablePartitionsForCluster(clusterId: string, accountName: string):
// Promise<GetAvailablePartitionsForClusterResponse> {

//   if (process.env.NODE_ENV === "test" || USE_MOCK) {
//     return { partitions: []};
//   }

//   const resp = authenticate();
//   if (!resp) {
//     throw new Error("Can not Access to SCOW mis-server.");
//   }

//   const commonConfigClient = getScowClient(ConfigServiceClient);

//   const availablePartitions
//     = await asyncClientCall(commonConfigClient, "getAvailablePartitionsForCluster", {
//       cluster: clusterId, accountName, userId: "",
//     });
//   if (!availablePartitions || availablePartitions.partitions.length === 0) {
//     logger.info("Can not find available partitions of %s in %s.", accountName, clusterId);
//     return { partitions: []};
//   }

//   return availablePartitions;

// }
