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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { plugin } from "@ddadaal/tsgrpc-server";
import { checkSchedulerApiVersion } from "@scow/lib-server";
import { ConfigServiceServer, ConfigServiceService, Partition } from "@scow/protos/build/common/config";
import { ConfigServiceServer as runTimeConfigServiceServer, ConfigServiceService as runTimeConfigServiceService }
  from "@scow/protos/build/portal/config";
import { ApiVersion } from "@scow/utils/build/version";
import { getAdapterClient } from "src/utils/clusters";
import { clusterNotFound } from "src/utils/errors";

export const staticConfigServiceServer = plugin((server) => {
  return server.addService<ConfigServiceServer>(ConfigServiceService, {
    getClusterConfig: async ({ request }) => {
      const { cluster } = request;

      const client = getAdapterClient(cluster);
      if (!client) { throw clusterNotFound(cluster); }

      const reply = await asyncClientCall(client.config, "getClusterConfig", {});

      return [reply];
    },

    getAvailablePartitionsForCluster: async ({ request, logger }) => {

      const { cluster, accountName, userId } = request;
      let availablePartitions: Partition[];
      const client = getAdapterClient(cluster);
      if (!client) { throw clusterNotFound(cluster); }
      try {
        const resp = await asyncClientCall(client.config, "getAvailablePartitions",
          { accountName, userId });
        availablePartitions = resp.partitions;
      } catch (error) {
        logger.error(`Error occured when query the available partitions of ${userId} in ${accountName}.`);
        availablePartitions = [];
      }

      return [ { partitions: availablePartitions } ];
    },


  });
});

export const runtimeConfigServiceServer = plugin((server) => {
  return server.addService<runTimeConfigServiceServer>(runTimeConfigServiceService, {
    getClusterInfo: async ({ request }) => {
      const { cluster } = request;

      const client = getAdapterClient(cluster);
      if (!client) { throw clusterNotFound(cluster); }

      // 当前接口要求的最低调度器接口版本
      const minRequiredApiVersion: ApiVersion = { major: 1, minor: 4, patch: 0 };
      // 检验调度器的API版本是否符合要求，不符合要求报错
      await checkSchedulerApiVersion(client, minRequiredApiVersion);

      const reply = await asyncClientCall(client.config, "getClusterInfo", {});

      return [reply];
    },
  });
});
