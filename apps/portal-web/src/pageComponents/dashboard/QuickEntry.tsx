import { QuickEntry as LibQuickEntry } from "@scow/lib-web/build/components/quickEntry";
import { Entry } from "@scow/protos/build/portal/dashboard";
import { message } from "antd";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AllJobsIcon, AppSessionsIcon, FileManagerIcon, LoginClusterIcon, RunningJobsIcon,
  ShellIcon, SubmitJobIcon, TemplateJobIcon } from "src/icons/headerIcons/headerIcons";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { Cluster } from "src/utils/cluster";
import { publicConfig } from "src/utils/config";

interface App { id: string; name: string; logoPath?: string; };

export type AppWithCluster = Record<string, {
  app: App;
  clusters: Cluster[];
}>;

export const QuickEntry: React.FC = () => {

  const p = prefix("pageComp.dashboard.quickEntry.");
  const t = useI18nTranslateToString();

  const languageId = useI18n().currentLanguage.id;

  const { loginNodes } = useStore(LoginNodeStore);
  const { publicConfigClusters, currentClusters } = useStore(ClusterInfoStore);

  const iconMap = {
    "PlusCircleOutlined": <SubmitJobIcon />,
    "BookOutlined": <RunningJobsIcon />,
    "SaveOutlined": <TemplateJobIcon />,
    "LoginClusterOutlined": <LoginClusterIcon />,
    "MacCommandOutlined": <ShellIcon />,
    "AllJobsOutlined":<AllJobsIcon />,
    "AppSessionsIcon":<AppSessionsIcon />,
    "FileManagerIcon":<FileManagerIcon />,
  };

  const entryItems = {
    defaultEntries:[
      {
        id:"submitJob",
        name:"submitJob",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/submit",
            icon:"PlusCircleOutlined",
          },
        },
      },
      {
        id:"runningJob",
        name:"runningJobs",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/runningJobs",
            icon:"BookOutlined",
          },
        },
      },
      {
        id:"allJobs",
        name:"allJobs",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/allJobs",
            icon:"AllJobsOutlined",
          },
        },
      },
      {
        id:"savedJobs",
        name:"savedJobs",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/jobs/savedJobs",
            icon:"SaveOutlined",
          },
        },
      },
    ],
    staticEntries: [
      {
        id:"loginCluster",
        name:"loginCluster",
        entry:{
          $case:"pageLink" as const,
          pageLink:{
            path: "/loginCluster",
            icon:"LoginClusterOutlined",
          },
        },
      },
      {
        id:"shell",
        name:"shell",
        entry:{
          $case:"shell" as const,
          shell:{
            clusterId:"",
            loginNode:"",
            icon:"MacCommandOutlined",
          },
        },
      },
      {
        id:"appSessions",
        name:"appSessions",
        entry:{
          $case:"clusterPageLink" as const,
          clusterPageLink:{
            path: "/apps/clusterId/sessions",
            clusterId:"",
            icon:"AppSessionsIcon",
          },
        },
      },
      {
        id:"fileManage",
        name:"fileManage",
        entry:{
          $case:"clusterPageLink" as const,
          clusterPageLink:{
            path: "/files/clusterId/~",
            clusterId:"",
            icon:"FileManagerIcon",
          },
        },
      },
    ],
  };

  const { data: quickEntriesData, isLoading: getQuickEntriesLoading } =
    useAsync({ promiseFn: useCallback(async () => {
      return await api.getQuickEntries({});
    }, []) });


  // apps包含在哪些集群上可以创建app
  const { data: apps } = useAsync({ promiseFn: useCallback(async () => {
    // 检查 currentClusters 是否为空
    if (!currentClusters || currentClusters.length === 0) {
      return {};
    }

    const clusterIds = currentClusters.map((cluster) => cluster.id);
    const appsResponse = await api.getAllClustersAvailableApps({ query: { clusterIds } });
    const appsInfo = appsResponse.results;

    const appWithCluster: AppWithCluster = {};
    appsInfo.forEach((clusterApps) => {
      const cluster = currentClusters.find((c) => c.id === clusterApps.clusterId);
      if (!cluster) return;

      clusterApps.apps.forEach((app) => {
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
  }, [currentClusters]) });

  const onSaveQuickEntries = async (newItems: Entry[]) => {
    await api.saveQuickEntries({ body:{
      quickEntries:newItems,
    } })
      .httpError(200, () => { message.error(t(p("saveFailed"))); })
      .then(() => {
        message.success(t(p("saveSuccessfully")));
      });
  };

  return (
    <LibQuickEntry
      isLoading={getQuickEntriesLoading}
      currentClusters={currentClusters}
      publicConfigClusters={publicConfigClusters}
      publicPath={publicConfig.PUBLIC_PATH}
      languageId={languageId}
      entryItems={entryItems}
      iconMap={iconMap}
      loginNodes={loginNodes}
      quickEntriesData={quickEntriesData?.quickEntries?.length ?
        quickEntriesData.quickEntries : entryItems.defaultEntries}
      availableApps={apps || {}}
      onSaveQuickEntries={onSaveQuickEntries}
    />
  );
};
