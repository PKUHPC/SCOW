import { SummaryPartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";

export interface Cluster {
  name: (string | {
    i18n: {
      default: string;
      en?: string | undefined;
      zh_cn?: string | undefined;
    };
  }) & (string | {
    i18n: {
      default: string;
      en?: string | undefined;
      zh_cn?: string | undefined;
    };
  } | undefined);
  id: string;
}

export interface ClusterOverview {
  clusterId: string,
  partitionName: string,
  nodeCount: number,
  runningNodeCount: number,
  idleNodeCount: number,
  notAvailableNodeCount: number,
  cpuCoreCount: number,
  runningCpuCount: number,
  idleCpuCount: number,
  notAvailableCpuCount: number,
  gpuCoreCount: number,
  runningGpuCount: number,
  idleGpuCount: number,
  notAvailableGpuCount: number,
  jobCount: number,
  runningJobCount: number,
  pendingJobCount: number,
  partitionStatus: number,
}

export interface PlatformOverview {
  nodeCount: number,
  runningNodeCount: number,
  idleNodeCount: number,
  notAvailableNodeCount: number,
  cpuCoreCount: number,
  runningCpuCount: number,
  idleCpuCount: number,
  notAvailableCpuCount: number,
  gpuCoreCount: number,
  runningGpuCount: number,
  idleGpuCount: number,
  notAvailableGpuCount: number,
  jobCount: number,
  runningJobCount: number,
  pendingJobCount: number,
  partitionStatus: number,
}

export interface SummaryPartition {
  partitionName: string;
  nodeCount: number;
  nodeUsage: number;
  cpuCoreCount?: number;
  cpuUsage: number;
  gpuCoreCount?: number;
  gpuUsage: number;
  pendingJobCount: number;
  partitionStatus: SummaryPartitionInfo_PartitionStatus;
}

export interface SummaryClusterInfo {
  clusterId: string;
  nodeCount: number;
  runningNodeCount: number;
  idleNodeCount: number;
  notAvailableNodeCount?: number;
  cpuCoreCount: number;
  runningCpuCount: number;
  idleCpuCount: number;
  notAvailableCpuCount?: number;
  gpuCoreCount: number;
  runningGpuCount: number;
  idleGpuCount: number;
  notAvailableGpuCount?: number;
  runningJobCount: number;
  pendingJobCount: number;
  nodeUsage: number;
  cpuUsage: number;
  gpuUsage: number;
  partitions: SummaryPartition[];
}
