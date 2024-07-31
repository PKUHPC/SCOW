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

import { Plugin, plugin } from "@ddadaal/tsgrpc-server";
import { ScowResourcesSchema } from "@scow/config/build/common";
import { GetAccountAssignedClusterPartitionsRequest,
  GetAccountAssignedClusterPartitionsResponse,
  GetAccountDefaultClusterPartitionsRequest,
  GetAccountDefaultClusterPartitionsResponse,
  GetAccountsAssignedClustersRequest,
  GetAccountsAssignedClustersResponse } from "@scow/scow-resources-protos/build/partition";

import { getScowResourcesClient } from "./client";

export interface ScowResourcesPlugin {
  resources: {

    getAccountsAssignedClusters: (params: GetAccountsAssignedClustersRequest) => 
    Promise<GetAccountsAssignedClustersResponse>;

    getAccountAssignedClusterPartitions: (params: GetAccountAssignedClusterPartitionsRequest) =>
    Promise<GetAccountAssignedClusterPartitionsResponse>; 

    getAccountAssignedPartitions: (params: GetAccountAssignedClusterPartitionsRequest) => 
    Promise<string[]>;

    getAccountDefaultClusterPartitions: (params: GetAccountDefaultClusterPartitionsRequest) =>
    Promise<GetAccountDefaultClusterPartitionsResponse>

    getAccountDefaultPartitions: (params: GetAccountAssignedClusterPartitionsRequest) => 
    Promise<string[]>;

  }
};
  
export const scowResourcesPlugin = (
  config: ScowResourcesSchema,
): Plugin => plugin(async (f) => {
  
  const logger = f.logger.child({ plugin: "scow-resources" });
  
  if (!config?.scowResourcesEnabled) {
    logger.info("No scow-resources related configuration.");
    return;
  }
  
  const client = getScowResourcesClient(config.address);

  const getAccountsAssignedClusters = async (params: GetAccountsAssignedClustersRequest) => { 
    return await client.resources.getAccountsAssignedClusters(params);
  };

  const getAccountAssignedClusterPartitions = async (params: GetAccountAssignedClusterPartitionsRequest) => { 
    return await client.resources.getAccountsAssignedClusters(params);
  };

  const getAccountDefaultClusterPartitions = async (params: GetAccountDefaultClusterPartitionsRequest) => { 
    return await client.resources.getAccountsAssignedClusters(params);
  };

  const getAccountAssignedPartitions = async (params: GetAccountAssignedClusterPartitionsRequest) => { 
    const reply = await client.resources.getAccountAssignedClusterPartitions(params);
    const assignedInfo = Object.values(reply.assignedClusterPartitions.assignedInfo);
    const assignedPartitions = assignedInfo.map((x) => x.partition);
    return assignedPartitions;
  };

  const getAccountDefaultPartitions = async (params: GetAccountDefaultClusterPartitionsRequest) => { 
    const reply = await client.resources.getAccountDefaultClusterPartitions(params);
    const assignedInfo = Object.values(reply.assignedClusterPartitions.assignedInfo);
    const assignedPartitions = assignedInfo.map((x) => x.partition);
    return assignedPartitions;
  };
  
  f.addExtension("resources", 
    { getAccountsAssignedClusters, 
      getAccountAssignedClusterPartitions, 
      getAccountDefaultClusterPartitions,
      getAccountAssignedPartitions,
      getAccountDefaultPartitions,
    });
});