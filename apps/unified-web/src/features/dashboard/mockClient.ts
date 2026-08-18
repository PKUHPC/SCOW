import type { DashboardApi, DashboardClusterSummary, QuickEntry } from "src/features/dashboard/types";

let quickEntries: QuickEntry[] = [];

const summary = (
  clusterId: string,
  source: "portal" | "ai",
  nodeCount: number,
  gpuCoreCount: number,
): DashboardClusterSummary => ({
  clusterId,
  source,
  nodeCount,
  runningNodeCount: Math.round(nodeCount * 0.55),
  idleNodeCount: Math.round(nodeCount * 0.35),
  notAvailableNodeCount: Math.round(nodeCount * 0.1),
  cpuCoreCount: nodeCount * 64,
  runningCpuCount: Math.round(nodeCount * 64 * 0.6),
  idleCpuCount: Math.round(nodeCount * 64 * 0.35),
  notAvailableCpuCount: Math.round(nodeCount * 64 * 0.05),
  gpuCoreCount,
  runningGpuCount: Math.round(gpuCoreCount * 0.65),
  idleGpuCount: Math.round(gpuCoreCount * 0.3),
  notAvailableGpuCount: Math.round(gpuCoreCount * 0.05),
  runningJobCount: Math.round(nodeCount * 1.5),
  pendingJobCount: Math.round(nodeCount * 0.4),
  nodeUsage: 55,
  cpuUsage: 60,
  gpuUsage: gpuCoreCount ? 65 : 0,
  partitions: [
    {
      partitionName: source === "portal" ? "compute" : "gpu",
      nodeCount,
      nodeUsage: 55,
      cpuCoreCount: nodeCount * 64,
      cpuUsage: 60,
      gpuCoreCount,
      gpuUsage: gpuCoreCount ? 65 : 0,
      pendingJobCount: Math.round(nodeCount * 0.4),
      partitionStatus: 2,
    },
  ],
});

export const mockDashboardClient: DashboardApi = {
  async getDashboardData(enabledSources) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const portalEnabled = enabledSources.includes("portal");
    const aiEnabled = enabledSources.includes("ai");
    const clusters = [
      ...(portalEnabled ? [{ id: "hpc-a", name: "HPC 集群 A", source: "portal" as const }] : []),
      ...(aiEnabled ? [{ id: "ai-gpu", name: "AI GPU 集群", source: "ai" as const }] : []),
    ];
    const summaries = [
      ...(portalEnabled ? [summary("hpc-a", "portal", 48, 0)] : []),
      ...(aiEnabled ? [summary("ai-gpu", "ai", 32, 128)] : []),
    ];

    return {
      clusters,
      summaries,
      failedClusters: [],
      isFullDisplayMode: true,
      failedSources: [],
    };
  },
  async listQuickEntries(enabledSources, sourceBasePaths) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return {
      source: enabledSources.includes("portal") ? "portal" : "ai",
      entries: structuredClone(quickEntries),
      currentClusters: [
        { id: "hpc-a", name: "HPC 集群 A" },
        { id: "ai-gpu", name: "AI GPU 集群" },
      ],
      publicConfigClusters: [
        { id: "hpc-a", name: "HPC 集群 A" },
        { id: "ai-gpu", name: "AI GPU 集群" },
      ],
      loginNodes: {
        "hpc-a": [{ name: "登录节点 1", address: "login.hpc-a" }],
        "ai-gpu": [{ name: "登录节点 1", address: "login.ai-gpu" }],
      },
      availableApps: {
        jupyter: {
          app: { id: "jupyter", name: "JupyterLab" },
          clusters: [{ id: "ai-gpu", name: "AI GPU 集群" }],
        },
      },
      publicPath: "",
      basePath: sourceBasePaths[enabledSources.includes("portal") ? "portal" : "ai"] ?? "",
    };
  },
  async saveQuickEntries(_source, entries) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    quickEntries = structuredClone(entries);
  },
};
