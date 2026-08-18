import axios from "axios";
import { getDomainApiBase } from "src/api/http";
import type {
  DashboardApi,
  DashboardCluster,
  DashboardClusterSummary,
  DashboardData,
  DashboardSource,
  LocalizedText,
  QuickEntry,
  QuickEntryCluster,
} from "src/features/dashboard/types";
import { toQuickEntryClusterName } from "src/features/dashboard/utils";

interface PortalInitialConfig {
  userInfo?: { isAdmin: boolean };
  initialCurrentClusters?: { id: string; name: LocalizedText }[];
  dashboardUserDisplayMode: "full" | "simplified";
  clusterConfigs: Record<string, { displayName: LocalizedText }>;
  loginNodes: Record<string, { name: LocalizedText; address: string }[]>;
  publicPath: string;
}

interface PortalSummaryResponse {
  results: Omit<DashboardClusterSummary, "source">[];
}

interface AiConfig {
  CLUSTERS: { id: string; name: LocalizedText }[];
  DASHBOARD_USER_DISPLAY_MODE: "full" | "simplified";
  PUBLIC_PATH: string;
}

interface AiUserResponse {
  user: {
    identityId: string;
    tenantRoles?: number[];
    platformRoles?: number[];
  };
}

interface AiClusterIdsResponse {
  clusterIds: string[];
}

interface AvailableApp {
  id: string;
  name: string;
  logoPath?: string;
}

interface ClusterApps {
  clusterId: string;
  apps: AvailableApp[];
}

interface AiClusterConfig {
  loginNodes: (string | { name: LocalizedText; address: string })[];
}

interface DomainDashboardData {
  clusters: DashboardCluster[];
  summaries: DashboardClusterSummary[];
  failedClusters: DashboardCluster[];
  isFullDisplayMode: boolean;
}

const portalClient = axios.create({ baseURL: getDomainApiBase("portal"), withCredentials: true });
const aiClient = axios.create({ baseURL: getDomainApiBase("ai"), withCredentials: true });

const getFailedClusters = (clusters: DashboardCluster[], summaries: DashboardClusterSummary[]) => {
  const successfulIds = new Set(summaries.map((summary) => summary.clusterId));
  return clusters.filter((cluster) => !successfulIds.has(cluster.id));
};

const toQuickEntryClusters = (clusters: { id: string; name: LocalizedText }[]): QuickEntryCluster[] =>
  clusters.map((cluster) => ({ ...cluster, name: toQuickEntryClusterName(cluster.name) }));

const buildAvailableApps = (clusterApps: ClusterApps[], clusters: QuickEntryCluster[]) => {
  const availableApps: Record<
    string,
    { app: AvailableApp; clusters: QuickEntryCluster[] }
  > = {};
  for (const result of clusterApps) {
    const cluster = clusters.find(({ id }) => id === result.clusterId);
    if (!cluster) continue;

    for (const app of result.apps) {
      availableApps[app.id] ??= { app, clusters: [] };
      if (!availableApps[app.id].app.logoPath && app.logoPath) availableApps[app.id].app.logoPath = app.logoPath;
      availableApps[app.id].clusters.push(cluster);
    }
  }
  return availableApps;
};

async function loadPortalDashboard(): Promise<DomainDashboardData> {
  const initialConfig = (await portalClient.get<PortalInitialConfig>("/getAppInitialConfig")).data;
  const clusters = (initialConfig.initialCurrentClusters ?? []).map((cluster) => ({
    ...cluster,
    source: "portal" as const,
  }));
  const isFullDisplayMode =
    Boolean(initialConfig.userInfo?.isAdmin) || initialConfig.dashboardUserDisplayMode === "full";

  if (clusters.length === 0) {
    return { clusters, summaries: [], failedClusters: [], isFullDisplayMode };
  }

  let summaries: DashboardClusterSummary[] = [];
  try {
    const response = await portalClient.get<PortalSummaryResponse>("/dashboard/getAllSummaryClustersInfo", {
      params: {
        clusterIds: clusters.map((cluster) => cluster.id),
        isFullDisplayMode,
      },
      paramsSerializer: { indexes: null },
    });
    summaries = response.data.results.map((summary) => ({ ...summary, source: "portal" as const }));
  } catch {
    return { clusters, summaries, failedClusters: clusters, isFullDisplayMode };
  }

  return {
    clusters,
    summaries,
    failedClusters: getFailedClusters(clusters, summaries),
    isFullDisplayMode,
  };
}

async function loadAiDashboard(): Promise<DomainDashboardData> {
  const [configResponse, userResponse, clusterIdsResponse] = await Promise.all([
    aiClient.get<AiConfig>("/config"),
    aiClient.get<AiUserResponse>("/auth/userInfo"),
    aiClient.get<AiClusterIdsResponse>("/resource/currentClusterIds"),
  ]);
  const config = configResponse.data;
  const user = userResponse.data.user;
  const assignedIds = new Set(clusterIdsResponse.data.clusterIds);
  const clusters = config.CLUSTERS.filter((cluster) => assignedIds.has(cluster.id)).map((cluster) => ({
    ...cluster,
    source: "ai" as const,
  }));
  const isAdmin = Boolean(user.tenantRoles?.includes(0) || user.platformRoles?.includes(0));
  const isFullDisplayMode = isAdmin || config.DASHBOARD_USER_DISPLAY_MODE === "full";

  if (clusters.length === 0) {
    return { clusters, summaries: [], failedClusters: [], isFullDisplayMode };
  }

  let summaries: DashboardClusterSummary[] = [];
  try {
    summaries = (
      await aiClient.post<Omit<DashboardClusterSummary, "source">[]>("/dashboard/summaryClusters", {
        clusterIds: clusters.map((cluster) => cluster.id),
        isFullDisplayMode,
        userId: user.identityId,
      })
    ).data.map((summary) => ({ ...summary, source: "ai" as const }));
  } catch {
    return { clusters, summaries, failedClusters: clusters, isFullDisplayMode };
  }

  return {
    clusters,
    summaries,
    failedClusters: getFailedClusters(clusters, summaries),
    isFullDisplayMode,
  };
}

const loaders: Record<DashboardSource, () => Promise<DomainDashboardData>> = {
  portal: loadPortalDashboard,
  ai: loadAiDashboard,
};

export const realDashboardClient: DashboardApi = {
  async getDashboardData(enabledSources) {
    const results = await Promise.allSettled(enabledSources.map((source) => loaders[source]()));
    const successfulResults = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const failedSources = results.flatMap((result, index) =>
      result.status === "rejected" ? [enabledSources[index]] : [],
    );

    const allClusters = successfulResults.flatMap((result) => result.clusters);
    const allSummaries = successfulResults.flatMap((result) => result.summaries);
    const portalSuccessfulIds = new Set(
      allSummaries.filter((summary) => summary.source === "portal").map((summary) => summary.clusterId),
    );
    const aiSuccessfulIds = new Set(
      allSummaries.filter((summary) => summary.source === "ai").map((summary) => summary.clusterId),
    );
    const portalClusterIds = new Set(
      allClusters.filter((cluster) => cluster.source === "portal").map((cluster) => cluster.id),
    );
    const preferredSource = (clusterId: string): DashboardSource => {
      if (portalSuccessfulIds.has(clusterId)) return "portal";
      if (aiSuccessfulIds.has(clusterId)) return "ai";
      return portalClusterIds.has(clusterId) ? "portal" : "ai";
    };
    const mergedSummaries = Array.from(new Set(allSummaries.map((summary) => summary.clusterId))).map((clusterId) => {
      const portalSummary = allSummaries.find(
        (summary) => summary.clusterId === clusterId && summary.source === "portal",
      );
      const aiSummary = allSummaries.find((summary) => summary.clusterId === clusterId && summary.source === "ai");

      if (!portalSummary || !aiSummary) return portalSummary ?? aiSummary!;

      const aiPartitions = new Map(aiSummary.partitions.map((partition) => [partition.partitionName, partition]));
      return {
        ...portalSummary,
        runningJobCount: portalSummary.runningJobCount + aiSummary.runningJobCount,
        pendingJobCount: portalSummary.pendingJobCount + aiSummary.pendingJobCount,
        partitions: portalSummary.partitions.map((partition) => ({
          ...partition,
          pendingJobCount:
            partition.pendingJobCount + (aiPartitions.get(partition.partitionName)?.pendingJobCount ?? 0),
        })),
      };
    });

    return {
      clusters: allClusters.filter((cluster) => cluster.source === preferredSource(cluster.id)),
      summaries: mergedSummaries,
      failedClusters: successfulResults
        .flatMap((result) => result.failedClusters)
        .filter((cluster) => cluster.source === preferredSource(cluster.id)),
      isFullDisplayMode: successfulResults.every((result) => result.isFullDisplayMode),
      failedSources,
    } satisfies DashboardData;
  },
  async listQuickEntries(enabledSources, sourceBasePaths) {
    const source = enabledSources.includes("portal") ? "portal" : "ai";
    if (source === "portal") {
      const [entriesResponse, initialConfigResponse] = await Promise.all([
        portalClient.get<{ quickEntries: QuickEntry[] }>("/dashboard/getQuickEntries"),
        portalClient.get<PortalInitialConfig>("/getAppInitialConfig"),
      ]);
      const initialConfig = initialConfigResponse.data;
      const currentClusters = toQuickEntryClusters(initialConfig.initialCurrentClusters ?? []);
      const publicConfigClusters = toQuickEntryClusters(
        Object.entries(initialConfig.clusterConfigs).map(([id, config]) => ({ id, name: config.displayName })),
      );
      const clusterApps = currentClusters.length
        ? (
            await portalClient.get<{ results: ClusterApps[] }>("/app/getAllClustersAvailableApps", {
              params: { clusterIds: currentClusters.map(({ id }) => id) },
              paramsSerializer: { indexes: null },
            })
          ).data.results
        : [];

      return {
        source,
        entries: entriesResponse.data.quickEntries,
        currentClusters,
        publicConfigClusters,
        loginNodes: Object.fromEntries(
          Object.entries(initialConfig.loginNodes).map(([clusterId, nodes]) => [
            clusterId,
            nodes.map((node) => ({ ...node, name: toQuickEntryClusterName(node.name) })),
          ]),
        ),
        availableApps: buildAvailableApps(clusterApps, currentClusters),
        publicPath: initialConfig.publicPath,
        basePath: sourceBasePaths.portal ?? "",
      };
    }

    const [entriesResponse, configResponse, clusterIdsResponse, clusterConfigResponse] = await Promise.all([
      aiClient.get<QuickEntry[]>("/dashboard/quick-entries"),
      aiClient.get<AiConfig>("/config"),
      aiClient.get<AiClusterIdsResponse>("/resource/currentClusterIds"),
      aiClient.get<Record<string, AiClusterConfig>>("/config/scowCluster"),
    ]);
    const assignedIds = new Set(clusterIdsResponse.data.clusterIds);
    const publicConfigClusters = toQuickEntryClusters(configResponse.data.CLUSTERS);
    const currentClusters = publicConfigClusters.filter(({ id }) => assignedIds.has(id));
    const clusterApps = currentClusters.length
      ? (
          await aiClient.post<ClusterApps[]>("/apps", {
            clusterIds: currentClusters.map(({ id }) => id),
          })
        ).data
      : [];

    return {
      source,
      entries: entriesResponse.data,
      currentClusters,
      publicConfigClusters,
      loginNodes: Object.fromEntries(
        Object.entries(clusterConfigResponse.data).map(([clusterId, config]) => [
          clusterId,
          config.loginNodes.map((node) =>
            typeof node === "string"
              ? { name: node, address: node }
              : { ...node, name: toQuickEntryClusterName(node.name) },
          ),
        ]),
      ),
      availableApps: buildAvailableApps(clusterApps, currentClusters),
      publicPath: configResponse.data.PUBLIC_PATH,
      basePath: sourceBasePaths.ai ?? "",
    };
  },
  async saveQuickEntries(source, entries) {
    if (source === "portal") {
      await portalClient.post("/dashboard/saveQuickEntries", { quickEntries: entries });
      return;
    }
    await aiClient.post("/dashboard/save-quick-entries", { quickEntries: entries });
  },
};
