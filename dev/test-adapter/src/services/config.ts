import { plugin } from "@ddadaal/tsgrpc-server";
import { ConfigServiceServer, ConfigServiceService } from "@scow/scheduler-adapter-protos/build/config";
import { clusterId } from "src/config/cluster";

export const configServiceServer = plugin((server) => {
  server.addService<ConfigServiceServer>(ConfigServiceService, {
    getClusterConfig: async () => {
      if (clusterId === "hpc00") {
        return [
          {
            partitions: [
              {
                name: "C032M0128G",
                memMb: 131072,
                cores: 32,
                nodes: 32,
                gpus: 0,
                qos: ["low", "normal", "high", "cryoem"],
                acceleratorDescriptions: [],
              },
              {
                name: "GPU",
                memMb: 262144,
                cores: 28,
                nodes: 32,
                gpus: 4,
                qos: ["low", "normal", "high", "cryoem"],
                acceleratorDescriptions: [],
              },
              { name: "life", memMb: 262144, cores: 28, nodes: 32, gpus: 4, qos: [], acceleratorDescriptions: [] },
            ],
            schedulerName: "slurm",
          },
        ];
      } else if (clusterId === "hpc01") {
        return [
          {
            partitions: [
              {
                name: "compute",
                nodes: 198,
                memMb: 63000,
                cores: 28,
                gpus: 0,
                qos: ["low", "normal", "high"],
                acceleratorDescriptions: [],
              },
              {
                name: "gpu",
                nodes: 1,
                memMb: 386000,
                cores: 48,
                gpus: 8,
                qos: ["low", "normal", "high"],
                acceleratorDescriptions: [],
              },
            ],
            schedulerName: "slurm",
          },
        ];
      } else if (clusterId === "hpc02") {
        return [
          {
            partitions: [
              {
                name: "compute",
                nodes: 198,
                memMb: 63000,
                cores: 28,
                gpus: 0,
                qos: ["low", "normal", "high"],
                acceleratorDescriptions: [],
              },
              {
                name: "gpu",
                nodes: 1,
                memMb: 386000,
                cores: 48,
                gpus: 8,
                qos: ["low", "normal", "high"],
                acceleratorDescriptions: [],
              },
            ],
            schedulerName: "slurm",
          },
        ];
      }
    },

    getAvailablePartitions: async () => {
      return [];
    },
    getClusterInfo: async () => {
      return [];
    },
    getSummaryClusterInfo: async () => {
      return [];
    },

    getClusterNodesInfo: async () => {
      return [];
    },

    listImplementedOptionalFeatures: async () => {
      return [];
    },
  });
});
