import type { DashboardClusterSummary, PlatformOverview } from "src/features/dashboard/types";

export const createEmptyPlatformOverview = (): PlatformOverview => ({
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
  partitionStatus: 1,
});

export const aggregatePlatformOverview = (summaries: DashboardClusterSummary[]) =>
  summaries.reduce((overview, cluster) => {
    overview.nodeCount += cluster.nodeCount;
    overview.runningNodeCount += cluster.runningNodeCount;
    overview.idleNodeCount += cluster.idleNodeCount;
    overview.notAvailableNodeCount += cluster.notAvailableNodeCount ?? 0;
    overview.cpuCoreCount += cluster.cpuCoreCount;
    overview.runningCpuCount += cluster.runningCpuCount;
    overview.idleCpuCount += cluster.idleCpuCount;
    overview.notAvailableCpuCount += cluster.notAvailableCpuCount ?? 0;
    overview.gpuCoreCount += cluster.gpuCoreCount;
    overview.runningGpuCount += cluster.runningGpuCount;
    overview.idleGpuCount += cluster.idleGpuCount;
    overview.notAvailableGpuCount += cluster.notAvailableGpuCount ?? 0;
    overview.runningJobCount += cluster.runningJobCount;
    overview.pendingJobCount += cluster.pendingJobCount;
    return overview;
  }, createEmptyPlatformOverview());
