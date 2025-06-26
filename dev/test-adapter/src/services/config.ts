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
import { clusterId } from "src/config/cluster";

export const configServiceServer = plugin((server) => {
  server.addService<ConfigServiceServer>(ConfigServiceService, {
    getClusterConfig: async () => {
      if (clusterId === "hpc00") {
        return [{
          partitions: [
            { name: "C032M0128G", memMb: 131072, cores: 32, nodes: 32, gpus: 0,
              qos: ["low", "normal", "high", "cryoem"]},
            { name: "GPU", memMb: 262144, cores: 28, nodes: 32, gpus: 4,
              qos: ["low", "normal", "high", "cryoem"]},
            { name: "life", memMb: 262144, cores: 28, nodes: 32, gpus: 4,
              qos: []},
          ],
          schedulerName: "slurm",
        }];
      } else if (clusterId === "hpc01") {
        return [{
          partitions: [
            { name: "compute", nodes: 198, memMb: 63000, cores: 28, gpus: 0, qos: ["low", "normal", "high"]},
            { name: "gpu", nodes: 1, memMb: 386000, cores: 48, gpus: 8, qos: ["low", "normal", "high"]},
          ],
          schedulerName: "slurm",
        }];
      } else if (clusterId === "hpc02") {
        return [{
          partitions: [
            { name: "compute", nodes: 198, memMb: 63000, cores: 28, gpus: 0, qos: ["low", "normal", "high"]},
            { name: "gpu", nodes: 1, memMb: 386000, cores: 48, gpus: 8, qos: ["low", "normal", "high"]},
          ],
          schedulerName: "slurm",
        }];
      }
    },

    getAvailablePartitions: async () => {
      return [];
    },
    getClusterInfo:async () => {
      return [];
    },
    getClusterNodesInfo:async () => {
      return [];
    },

    listImplementedOptionalFeatures: async () => {
      return [];
    },

  });
});
