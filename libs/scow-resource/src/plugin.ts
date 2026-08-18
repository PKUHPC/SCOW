import { Plugin, plugin } from "@ddadaal/tsgrpc-server";
import { ScowResourceConfigSchema } from "@scow/config/build/common";
import {
  AssignAccountOnCreateRequest,
  GetAccountAssignedPartitionsForClusterRequest,
  GetAccountsAssignedClusterIdsRequest,
  GetAccountsAssignedClustersAndPartitionsRequest,
  GetAccountsAssignedPartitionsForClusterRequest,
  GetClusterAssignedAccountsRequest,
  GetTenantAssignedClustersAndPartitionsRequest,
  GetTenantAssignedClustersAndPartitionsResponse,
} from "@scow/scow-resource-protos/build/partition";
import { ClusterPartition, PartitionNames } from "@scow/scow-resource-protos/build/partition_pb";

import { getScowResourceClient } from "./client";

interface AccountClusterPartitions {
  clusterPartitions: ClusterPartition[];
}

export interface ScowResourcePlugin {
  resource: {
    assignAccountOnCreate: (params: AssignAccountOnCreateRequest) => Promise<void>;

    getAccountAssignedPartitionsForCluster: (
      params: GetAccountAssignedPartitionsForClusterRequest,
    ) => Promise<string[]>;

    getAccountsAssignedPartitionsForCluster: (
      params: GetAccountsAssignedPartitionsForClusterRequest,
    ) => Promise<Record<string, PartitionNames>>;

    getAccountsAssignedClusterIds: (params: GetAccountsAssignedClusterIdsRequest) => Promise<string[]>;

    getAccountsAssignedClustersAndPartitions: (
      params: GetAccountsAssignedClustersAndPartitionsRequest,
    ) => Promise<Record<string, AccountClusterPartitions>>;

    getTenantAssignedClustersAndPartitions: (
      params: GetTenantAssignedClustersAndPartitionsRequest,
    ) => Promise<GetTenantAssignedClustersAndPartitionsResponse>;

    getClusterAssignedAccounts: (params: GetClusterAssignedAccountsRequest) => Promise<string[]>;
  };
}

export const scowResourcePlugin = (config: ScowResourceConfigSchema): Plugin =>
  plugin(async (f) => {
    const client = getScowResourceClient(config.address);

    const assignAccountOnCreate = async (params: AssignAccountOnCreateRequest) => {
      return await client.resource.assignAccountOnCreate(params);
    };

    const getAccountAssignedPartitionsForCluster = async (params: GetAccountAssignedPartitionsForClusterRequest) => {
      const reply = await client.resource.getAccountAssignedPartitionsForCluster(params);
      return reply.assignedPartitionNames;
    };

    const getAccountsAssignedPartitionsForCluster = async (params: GetAccountsAssignedPartitionsForClusterRequest) => {
      const reply = await client.resource.getAccountsAssignedPartitionsForCluster(params);
      return reply.assignedAccountPartitions;
    };

    const getAccountsAssignedClusterIds = async (params: GetAccountsAssignedClusterIdsRequest) => {
      return await client.resource.getAccountsAssignedClusterIds(params);
    };

    const getAccountsAssignedClustersAndPartitions = async (
      params: GetAccountsAssignedClustersAndPartitionsRequest,
    ) => {
      const reply = await client.resource.getAccountsAssignedClustersAndPartitions(params);
      return reply.assignedClusterPartitions.reduce<Record<string, AccountClusterPartitions>>((acc, item) => {
        acc[item.account] = {
          clusterPartitions: item.clusterPartitions,
        };
        return acc;
      }, {});
    };

    const getTenantAssignedClustersAndPartitions = async (params: GetTenantAssignedClustersAndPartitionsRequest) => {
      const reply = await client.resource.getTenantAssignedClustersAndPartitions(params);
      return reply;
    };

    const getClusterAssignedAccounts = async (params: GetClusterAssignedAccountsRequest) => {
      const reply = await client.resource.getClusterAssignedAccounts(params);
      return reply.accountNames;
    };

    f.addExtension("resource", {
      assignAccountOnCreate,
      getAccountAssignedPartitionsForCluster,
      getAccountsAssignedPartitionsForCluster,
      getAccountsAssignedClusterIds,
      getAccountsAssignedClustersAndPartitions,
      getTenantAssignedClustersAndPartitions,
      getClusterAssignedAccounts,
    });
  });
