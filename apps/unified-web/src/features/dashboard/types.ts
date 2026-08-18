export type DashboardSource = "portal" | "ai";

export type LocalizedText =
  | string
  | Partial<Record<"default" | "zhCn" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru", string>>
  | {
      i18n: { default: string } & Partial<
        Record<"zh_cn" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru", string>
      >;
    };

export interface DashboardCluster {
  id: string;
  name: LocalizedText;
  source: DashboardSource;
}

export interface DashboardPartitionInfo {
  partitionName: string;
  nodeCount: number;
  nodeUsage: number;
  cpuCoreCount: number;
  cpuUsage: number;
  gpuCoreCount: number;
  gpuUsage: number;
  pendingJobCount: number;
  partitionStatus: number;
}

export interface DashboardClusterSummary {
  clusterId: string;
  source: DashboardSource;
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
  partitions: DashboardPartitionInfo[];
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

export interface DashboardData {
  clusters: DashboardCluster[];
  summaries: DashboardClusterSummary[];
  failedClusters: DashboardCluster[];
  isFullDisplayMode: boolean;
  failedSources: DashboardSource[];
}

export interface QuickEntry {
  id: string;
  name: string;
  entry?:
    | { $case: "pageLink"; pageLink: { path: string; icon: string } }
    | { $case: "shell"; shell: { clusterId: string; loginNode: string; icon: string } }
    | { $case: "app"; app: { appId: string; clusterId: string; appLogoPath?: string } }
    | { $case: "clusterPageLink"; clusterPageLink: { path: string; clusterId: string; icon: string } };
}

export interface QuickEntriesData {
  source: DashboardSource;
  entries: QuickEntry[];
  currentClusters: QuickEntryCluster[];
  publicConfigClusters: QuickEntryCluster[];
  loginNodes: Record<string, { name: QuickEntryCluster["name"]; address: string }[]>;
  availableApps: Record<string, { app: { id: string; name: string; logoPath?: string }; clusters: QuickEntryCluster[] }>;
  publicPath: string;
  basePath: string;
}

export interface QuickEntryCluster {
  id: string;
  name: string | { i18n: { default: string } & Partial<Record<string, string>> };
}

export interface DashboardApi {
  getDashboardData: (enabledSources: DashboardSource[]) => Promise<DashboardData>;
  listQuickEntries: (
    enabledSources: DashboardSource[],
    sourceBasePaths: Partial<Record<DashboardSource, string>>,
  ) => Promise<QuickEntriesData>;
  saveQuickEntries: (source: DashboardSource, entries: QuickEntry[]) => Promise<void>;
}
