import { plugin } from "@ddadaal/tsgrpc-server";
import {
  ConfigServiceServer,
  ConfigServiceService,
} from "@scow/scheduler-adapter-protos/build/config";
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
      return [{ partitions: [] }];
    },
    getClusterInfo: async () => {
      return [
        {
          clusterName: "",
          partitions: [],
          nodeCount: 0,
          runningNodeCount: 0,
          idleNodeCount: 0,
          notAvailableNodeCount: 0,
          cpuCoreCount: 0,
          runningCpuCount: 0,
          idleCpuCount: 0,
          notAvailableCpuCount: 0,
          gpuCoreCount: 0,
          runningGpuCount: 0,
          idleGpuCount: 0,
          notAvailableGpuCount: 0,
          jobCount: 0,
          runningJobCount: 0,
          pendingJobCount: 0,
        },
      ];
    },
    getSummaryClusterInfo: async () => {
      return [
        {
          clusterName: "",
          partitions: [],
          nodeCount: 0,
          runningNodeCount: 0,
          idleNodeCount: 0,
          notAvailableNodeCount: 0,
          cpuCoreCount: 0,
          runningCpuCount: 0,
          idleCpuCount: 0,
          notAvailableCpuCount: 0,
          gpuCoreCount: 0,
          runningGpuCount: 0,
          idleGpuCount: 0,
          notAvailableGpuCount: 0,
          runningJobCount: 0,
          pendingJobCount: 0,
          nodeUsage: 0,
          cpuUsage: 0,
          gpuUsage: 0,
        },
      ];
    },

    getClusterNodesInfo: async () => {
      return [{ nodes: [] }];
    },

    listImplementedOptionalFeatures: async () => {
      return [{ features: [] }];
    },
  });
});
