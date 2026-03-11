import { I18nStringType } from "@scow/config/build/i18n";
import { QuickEntry as LibQuickEntry } from "@scow/lib-web/build/components/quickEntry";
import { message } from "antd";
import { useMemo } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { useI18n } from "src/i18n";
import { AlgorithmIcon, CreateAppIcon, DatasetIcon, FileIcon, HistoryJobsIcon, ImageIcon, InferIcon,
  ModelIcon, RunningJobsIcon,
  TrainJobIcon } from "src/icons/menuIcons";
import { Cluster } from "src/server/trpc/route/config";
import { EntryListSchema } from "src/server/trpc/route/dashboard";
import { trpc } from "src/utils/trpc";

interface App { id: string; name: string; logoPath?: string; };

type ClusterLoginNodes = Record<string, { name: I18nStringType, address: string; }[]>;

type AppWithCluster = Record<string, {
  app: App;
  clusters: Cluster[];
}>;

export const QuickEntry: React.FC = () => {

  const t = useI18nTranslateToString();
  const p = prefix("app.dashboard.quickEntry.");

  const { publicConfig: { CLUSTERS: currentClusters,
    PUBLIC_PATH: publicPath, BASE_PATH: basePath }, currentAvailableClusterIds } = usePublicConfig();

  const languageId = useI18n().currentLanguage.id;

  const currentAvailableClusters = useMemo(() => {
    return currentClusters.filter((c) => currentAvailableClusterIds.includes(c.id));
  }, [currentClusters, currentAvailableClusterIds]);

  const entryItems = {
    defaultEntries: [
      {
        id:"dataset",
        name:"dataset",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "asset/dataset",
            icon:"DatasetIcon",
          },
        },
      },
      {
        id:"image",
        name:"image",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "asset/image",
            icon:"ImageIcon",
          },
        },
      },
      {
        id:"algorithm",
        name:"algorithm",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "asset/algorithm",
            icon:"AlgorithmIcon",
          },
        },
      },
      {
        id:"model",
        name:"model",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "asset/model",
            icon:"ModelIcon",
          },
        },
      },
    ],
    staticEntries:[
      {
        id:"app",
        name:"app",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/createApp",
            icon:"CreateAppIcon",
          },
        },
      },
      {
        id:"trainJobs",
        name:"trainJobs",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/createTrain",
            icon:"TrainJobIcon",
          },
        },
      },
      {
        id:"inference",
        name:"inference",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/createInfer",
            icon:"InferIcon",
          },
        },
      },
      {
        id:"runningJobs",
        name:"runningJobs",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "jobs/jobList",
            icon:"RunningJobsIcon",
          },
        },
      },
      {
        id:"historyJobs",
        name:"historyJobs",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "jobs/jobList?jobType=historyJobs",
            icon:"HistoryJobsIcon",
          },
        },
      },
      {
        id:"file",
        name:"file",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "files/~",
            icon:"FileIcon",
          },
        },
      },
    ],
  };

  const iconMap = {
    "DatasetIcon": <DatasetIcon />,
    "ImageIcon": <ImageIcon />,
    "ModelIcon": <ModelIcon />,
    "AlgorithmIcon": <AlgorithmIcon />,
    "CreateAppIcon": <CreateAppIcon />,
    "TrainJobIcon": <TrainJobIcon />,
    "InferIcon": <InferIcon />,
    "RunningJobsIcon": <RunningJobsIcon />,
    "FileIcon": <FileIcon />,
    "HistoryJobsIcon": <HistoryJobsIcon />,
  };

  const { data: scowClusterConfigData } = trpc.config.getScowClusterConfig.useQuery();

  const { data: quickEntriesData, isLoading: getQuickEntriesLoading } = trpc.dashboard.getQuickEntries.useQuery();

  const { data: appsResponse } = trpc.jobs.listAvailableApps.useQuery(
    { clusterIds: currentClusters.map((cluster) => cluster.id) },
    { enabled: currentClusters && currentClusters.length !== 0 },
  );

  const loginNodes = useMemo(() => {
    const result: ClusterLoginNodes = {};
    for (const [clusterName, clusterData] of Object.entries(scowClusterConfigData || {})) {
      result[clusterName] = clusterData.loginNodes.map((node) => {
        return { name: typeof node === "string" ? node : node.name,
          address: typeof node === "string" ? node : node.address };
      });
    }
    return result;
  }, [scowClusterConfigData]);

  const availableApps: AppWithCluster = useMemo(() => {
    const appWithCluster: AppWithCluster = {};
    appsResponse?.forEach((clusterApps) => {
      const cluster = currentClusters.find((c) => c.id === clusterApps?.clusterId);
      if (!cluster) return;

      clusterApps?.apps.forEach((app) => {
        if (!appWithCluster[app.id]) {
          appWithCluster[app.id] = {
            app: app,
            clusters: [],
          };
        }

        // 只要有一个集群配置了app图片，快捷方式就可以显示app图片了
        if (!appWithCluster[app.id].app.logoPath && app.logoPath) {
          appWithCluster[app.id].app.logoPath = app.logoPath;
        }

        appWithCluster[app.id].clusters.push(cluster);
      });
    });
    return appWithCluster;
  }, [appsResponse]);

  const saveEntriesMutation = trpc.dashboard.saveQuickEntries?.useMutation({
    onSuccess() {
      message.success(t(p("saveSuccessfully")));
    },
    onError() {
      message.error(t(p("saveFailed")));
    },
  });

  const onSaveQuickEntries = (newItems: EntryListSchema) => {
    saveEntriesMutation?.mutate({
      quickEntries: newItems,
    });
  };


  return (
    <LibQuickEntry
      isLoading={getQuickEntriesLoading}
      quickEntryType="ai"
      currentClusters={currentAvailableClusters}
      publicConfigClusters={currentAvailableClusters}
      publicPath={publicPath}
      basePath={basePath}
      languageId={languageId}
      entryItems={entryItems}
      iconMap={iconMap}
      loginNodes={loginNodes}
      quickEntriesData={quickEntriesData?.length ?
        quickEntriesData : entryItems.defaultEntries}
      availableApps={availableApps}
      onSaveQuickEntries={onSaveQuickEntries}
    />
  );
};
