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

import { plugin } from "@ddadaal/tsgrpc-server";
import { ConfigServiceServer, ConfigServiceService } from "@scow/scheduler-adapter-protos/build/protos/config";

export const configServiceServer = plugin((server) => {
  server.addService<ConfigServiceServer>(ConfigServiceService, {
    getClusterConfig: async () => {
      return [{
        partitions: [
          { name: "compute", nodes: 198, memMb: 63000, cores: 28, gpus: 0, qos: ["low", "normal", "high"]},
          { name: "gpu", nodes: 1, memMb: 386000, cores: 48, gpus: 8, qos: ["low", "normal", "high"]},
        ],
        schedulerName: "slurm",
      }];
    },

  });
});
