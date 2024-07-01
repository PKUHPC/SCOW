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
import { ScowResourceManagementSchema } from "@scow/config/build/common";
import { Logger } from "ts-log";

export type AssignedPartition = {
  clusterId: string,
  partition: string,
}

export interface AccountPartitionsList {
  tenantName: string;
  assignedPartitions: AssignedPartition[];
  assignedTotalCount: number;
}

const applicationJsonHeaders = {
  "Content-Type": "application/json",
};

export const logHttpErrorAndThrow = (response: Response, logger?: Logger) => {
  if (logger) {
    logger.error(`HTTP error: ${response.status} - ${response.statusText}`);
  }
  throw new Error(`HTTP error: ${response.status}`);
};

const getAccountAssignedPartitionsFromSRM = async (
  scowPartitionsUrl: string,
  params: { accountName: string, clusterId: string },
  logger?: Logger,
): Promise<string[]> => {
  const resp = await fetch(scowPartitionsUrl + "/accountClusterPartitionsList", {
    method: "POST",
    body: JSON.stringify(params),
    headers: applicationJsonHeaders,
  });

  if (!resp.ok) {
    logHttpErrorAndThrow(resp, logger);
  }
  return await resp.json() as string[];
};


export type ScowPartitionsPlugin = {
    partitions: {
      getAssignedPartitions: (params: { accountName: string; clusterId: string }) => Promise<string[]>;
    }
}

export const scowPartitionsPlugin = (
  config: ScowResourceManagementSchema,
): Plugin => plugin(async (f) => {

  const logger = f.logger.child({ plugin: "scow-partitions" });

  if (!config || !config.scowPartitionsEnabled) {
    logger.info("No scow-partitions related configuration.");
    return;
  }

  const getAssignedPartitions = async (params: { accountName: string, clusterId: string }) => {
    return await getAccountAssignedPartitionsFromSRM(config.address, params, logger);
  };

  f.addExtension("partitions", getAssignedPartitions);
});
