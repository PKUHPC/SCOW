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

import { ScowResourceManagementSchema } from "@scow/config/build/common";
import { Logger } from "ts-log";

/**
 *
 * @param clusterId
 * @param accountName
 * @param config
 * @param logger
 * @param getAssignedPartitions
 * @returns if scow-resource-management-partitions is deployed ,return the specified assigned partitions
 * @returns if scow-resource-management-partitions is not deployed, return undefined, no specified partitions
 */
export const getAccountSpecifiedPartitions = async (
  clusterId: string,
  accountName: string,
  config: ScowResourceManagementSchema | undefined,
  logger: Logger,
  getAssignedPartitions?: (params: { accountName: string; clusterId: string }) => Promise<string[] | undefined>,
) => {
  if (config && config.scowPartitionsEnabled) {
    if (getAssignedPartitions) {
      return await getAssignedPartitions({ accountName, clusterId });
    } else {
      logger.error("SCOW Partitions Plugin is enabled but not available.");
      throw new Error("SCOW Partitions Plugin is enabled but not available.");
    }
  } else {
    return undefined;
  }
};
