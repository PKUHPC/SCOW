export interface ClusterOverview {
  clusterId: string;
  partitionName: string;
  nodeCount: number;
  runningNodeCount: number;
  idleNodeCount: number;
  notAvailableNodeCount: number;
  cpuCoreCount: number;
  runningCpuCount: number;
  idleCpuCount: number;
  notAvailableCpuCount: number;
  gpuCoreCount: number;
  runningGpuCount: number;
  idleGpuCount: number;
  notAvailableGpuCount: number;
  jobCount: number;
  runningJobCount: number;
  pendingJobCount: number;
  partitionStatus: number;
}

export interface PlatformOverview {
  nodeCount: number;
  runningNodeCount: number;
  idleNodeCount: number;
  notAvailableNodeCount: number;
  cpuCoreCount: number;
  runningCpuCount: number;
  idleCpuCount: number;
  notAvailableCpuCount: number;
  gpuCoreCount: number;
  runningGpuCount: number;
  idleGpuCount: number;
  notAvailableGpuCount: number;
  jobCount: number;
  runningJobCount: number;
  pendingJobCount: number;
  partitionStatus: number;
}
