import { Code, ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { ScowResourceConfigSchema } from "@scow/config/build/common";

import { getScowResourceClient } from "./client";
import { logger } from "./logger";

// 映射 tRPC 状态码到 gRPC 状态码的函数
function mapTRPCStatusToGRPC(statusCode: Code): status {
  switch (statusCode) {
    case Code.Canceled:
      return status.CANCELLED;
    case Code.Unknown:
      return status.UNKNOWN;
    case Code.InvalidArgument:
      return status.INVALID_ARGUMENT;
    case Code.DeadlineExceeded:
      return status.DEADLINE_EXCEEDED;
    case Code.NotFound:
      return status.NOT_FOUND;
    case Code.AlreadyExists:
      return status.ALREADY_EXISTS;
    case Code.PermissionDenied:
      return status.PERMISSION_DENIED;
    case Code.ResourceExhausted:
      return status.RESOURCE_EXHAUSTED;
    case Code.FailedPrecondition:
      return status.FAILED_PRECONDITION;
    case Code.Aborted:
      return status.ABORTED;
    case Code.OutOfRange:
      return status.OUT_OF_RANGE;
    case Code.Unimplemented:
      return status.UNIMPLEMENTED;
    case Code.Internal:
      return status.INTERNAL;
    case Code.Unavailable:
      return status.UNAVAILABLE;
    case Code.DataLoss:
      return status.DATA_LOSS;
    case Code.Unauthenticated:
      return status.UNAUTHENTICATED;
    default:
      return status.OK;
  }
}

// 映射 tRPC 异常到 gRPC 异常的函数
export function mapTRPCExceptionToGRPC(err: any): ServiceError {
  if (err instanceof ConnectError) {
    return {
      code: mapTRPCStatusToGRPC(err.code),
      details: `Error occured in resource system: ${err.message}`,
    } as ServiceError;
  }

  return {
    code: status.UNKNOWN,
    details: "An unknown error occurred in resource system.",
  } as ServiceError;
}

// 获取用户关联账户的已授权集群
export async function getUserAccountsClusterIds(
  scowResourceConfig: ScowResourceConfigSchema,
  userAccounts: string[] | undefined,
  tenantName: string | undefined,
): Promise<string[]> {
  if (!tenantName || !userAccounts || userAccounts.length === 0) {
    logger.error("Cannot get user accounts' authorized resource information due to missing tenant or accounts.");
    return [];
  }

  try {
    const resourceClient = getScowResourceClient(scowResourceConfig.address);
    const clusters = await resourceClient.resource.getAccountsAssignedClusterIds({
      accountNames: userAccounts,
      tenantName,
    });
    return clusters.assignedClusterIds;
  } catch (e) {
    const error = mapTRPCExceptionToGRPC(e);
    logger.error(
      `Failed to get user accounts' authorized clusters of ${userAccounts.length} ` +
        `accounts in ${tenantName}. ${error.details}`,
    );
    return [];
  }
}

// 获取用户关联账户的已授权集群和分区
export async function getUserAccountsClusterPartitions(
  scowResourceConfig: ScowResourceConfigSchema,
  userAccounts: string[] | undefined,
  tenantName: string | undefined,
): Promise<Record<string, string[]>> {
  if (!tenantName || !userAccounts || userAccounts.length === 0) {
    logger.error("Cannot get user accounts' authorized resource information due to missing tenant or accounts.");
    return {};
  }
  try {
    const resourceClient = getScowResourceClient(scowResourceConfig.address);

    const clusters = await resourceClient.resource.getAccountsAssignedClustersAndPartitions({
      accountNames: userAccounts,
      tenantName,
    });
    const merged: Record<string, string[]> = {};
    clusters.assignedClusterPartitions.forEach((accountPartitions) => {
      accountPartitions.clusterPartitions.forEach((clusterPartition) => {
        if (!merged[clusterPartition.cluster]) {
          merged[clusterPartition.cluster] = [];
        }
        clusterPartition.partitionName.forEach((partition) => {
          if (!merged[clusterPartition.cluster].includes(partition)) {
            merged[clusterPartition.cluster].push(partition);
          }
        });
      });
    });
    return merged;
  } catch (e) {
    const error = mapTRPCExceptionToGRPC(e);
    logger.error(
      `Failed to get user accounts' authorized cluster partitions of ${userAccounts.length} accounts ` +
        `in ${tenantName}}. ${error.details}`,
    );
    return {};
  }
}

// 获取用户关联账户的已授权集群和分区（按账户聚合）
export async function getUserAccountsClusterPartitionsByAccount(
  scowResourceConfig: ScowResourceConfigSchema,
  userAccounts: string[] | undefined,
  tenantName: string | undefined,
): Promise<Record<string, Record<string, string[]>>> {
  if (!tenantName || !userAccounts || userAccounts.length === 0) {
    logger.error("Cannot get user accounts' authorized resource information due to missing tenant or accounts.");
    return {};
  }
  try {
    const resourceClient = getScowResourceClient(scowResourceConfig.address);

    const clusters = await resourceClient.resource.getAccountsAssignedClustersAndPartitions({
      accountNames: userAccounts,
      tenantName,
    });
    return clusters.assignedClusterPartitions.reduce(
      (acc, accountPartitions) => {
        acc[accountPartitions.account] = accountPartitions.clusterPartitions.reduce(
          (clusterAcc, value) => {
            clusterAcc[value.cluster] = value.partitionName;
            return clusterAcc;
          },
          {} as Record<string, string[]>,
        );
        return acc;
      },
      {} as Record<string, Record<string, string[]>>,
    );
  } catch (e) {
    const error = mapTRPCExceptionToGRPC(e);
    logger.error(
      `Failed to get user accounts' authorized cluster partitions of ${userAccounts.length} accounts ` +
        `in ${tenantName}}. ${error.details}`,
    );
    return {};
  }
}

// 获取用户关联账户的已授权集群和分区
export async function getClusterAssignedAccounts(
  scowResourceConfig: ScowResourceConfigSchema,
  clusterId: string,
  tenantName: string,
): Promise<string[]> {
  try {
    const resourceClient = getScowResourceClient(scowResourceConfig.address);

    const result = await resourceClient.resource.getClusterAssignedAccounts({ clusterId, tenantName });

    return result.accountNames;
  } catch (e) {
    const error = mapTRPCExceptionToGRPC(e);
    logger.error(`Failed to get authorized accounts of tenant ${tenantName} in ${clusterId}. ${error.details}`);
    return [];
  }
}

// 获取用户关联账户的已授权集群和分区
export async function isAccountAuthorizedInClusterPartition(
  scowResourceConfig: ScowResourceConfigSchema,
  accountName: string,
  clusterId: string,
  partitionName?: string,
): Promise<boolean> {
  try {
    const resourceClient = getScowResourceClient(scowResourceConfig.address);

    const result = await resourceClient.resource.isAccountAuthorizedInClusterPartition({
      accountName,
      clusterId,
      partitionName,
    });
    return result.isAuthorized;
  } catch (e) {
    const partitionInfo = partitionName ? `: ${partitionName}` : "";
    const error = mapTRPCExceptionToGRPC(e);
    logger.error(
      `Failed to get the authorization state of account ${accountName} in ${clusterId}${partitionInfo}. ` +
        `${error.details}`,
    );
    return false;
  }
}
