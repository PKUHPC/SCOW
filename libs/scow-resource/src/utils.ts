import { Code, ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { ScowResourceConfigSchema } from "@scow/config/build/common";

import { getScowResourceClient } from "./client";

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
  // misDeployed: boolean,
  scowResourceConfig: ScowResourceConfigSchema,
  userAccounts: string[] | undefined,
  tenantName: string | undefined): Promise<string[]> {

  const resourceClient = getScowResourceClient(scowResourceConfig.address);

  const clusters =
    await resourceClient.resource.getAccountsAssignedClusterIds({ accountNames: userAccounts, tenantName });

  return clusters.assignedClusterIds;
};


// 获取用户关联账户的已授权集群和分区
export async function getUserAccountsClusterPartitions(
  scowResourceConfig: ScowResourceConfigSchema,
  userAccounts: string[] | undefined,
  tenantName: string | undefined): Promise<Record<string, string[]>> {

  const resourceClient = getScowResourceClient(scowResourceConfig.address);

  const clusters =
    await resourceClient.resource.getAccountsAssignedClustersAndPartitions({ accountNames: userAccounts, tenantName });

  return Object.entries(clusters.assignedClusterPartitions).reduce((acc, [key, value]) => {
    acc[key] = value.partitionNames;
    return acc;
  }, {});
};


// 获取用户关联账户的已授权集群和分区
export async function getClusterAssignedAccounts(
  scowResourceConfig: ScowResourceConfigSchema,
  clusterId: string,
  tenantName: string): Promise<string[]> {

  const resourceClient = getScowResourceClient(scowResourceConfig.address);

  const result =
    await resourceClient.resource.getClusterAssignedAccounts({ clusterId, tenantName });

  return result.accountNames;
};


// 获取用户关联账户的已授权集群和分区
export async function isAccountAuthorizedInClusterPartition(
  scowResourceConfig: ScowResourceConfigSchema,
  accountName: string,
  clusterId: string,
  partitionName?: string): Promise<boolean> {

  const resourceClient = getScowResourceClient(scowResourceConfig.address);

  const result =
    await resourceClient.resource.isAccountAuthorizedInClusterPartition({ accountName, clusterId, partitionName });
  return result.isAuthorized;
};

