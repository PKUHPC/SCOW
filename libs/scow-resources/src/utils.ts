/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { Code, ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { ScowResourcesSchema } from "@scow/config/build/common";

import { getScowResourcesClient } from "./client";

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
    return { code: mapTRPCStatusToGRPC(err.code), details: err.message } as ServiceError;
  }

  return {
    code: status.UNKNOWN,
    details: "An unknown error occurred.",
  } as ServiceError;
}



export async function getUserAccountsClusterIds(
  misDeployed: boolean,
  scowResourcesConfig: ScowResourcesSchema | undefined, 
  userAccounts: string[] | undefined, 
  tenantName: string | undefined): Promise<string[] | undefined> {

  if (!misDeployed || !scowResourcesConfig?.scowResourcesEnabled) {
    console.info("SCOW RESOURCES is not deployed, the user has not been assigned any authorized clusters.");
    return undefined;
  }

  const resourceClient = getScowResourcesClient(scowResourcesConfig.address);

  const clusters = 
  await resourceClient.resources.getAccountsAssignedClusters({ accountNames: userAccounts, tenantName });

  return clusters.clusterIds;

};