import { Entry } from "@scow/protos/build/portal/dashboard";
import { Button, Spin } from "antd";
import { useCallback, useState } from "react";
import { useAsync } from "react-async";
import { api } from "src/apis";
import { Localized, prefix } from "src/i18n";
import { EntryEditIcon } from "src/icons/headerIcons/headerIcons";
import { DashboardSection } from "src/pageComponents/dashboard/DashboardSection";
import { Sortable } from "src/pageComponents/dashboard/Sortable";
import { App } from "src/pages/api/app/listAvailableApps";
import { Cluster } from "src/utils/cluster";
import { styled } from "styled-components";

const CardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const EditButton = styled(Button)`
`;


export type AppWithCluster = Record<string, {
  app: App;
  clusters: Cluster[];
}>;

interface Props {
  currentClusters: Cluster[];
  publicConfigClusters: Cluster[];
}

export const defaultEntry: Entry[] = [
  {
    id:"submitJob",
    name:"submitJob",
    entry:{
      $case:"pageLink",
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
      $case:"pageLink",
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
      $case:"pageLink",
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
      $case:"pageLink",
      pageLink:{
        path: "/jobs/savedJobs",
        icon:"SaveOutlined",
      },
    },
  },
];
const p = prefix("pageComp.dashboard.quickEntry.");

export const QuickEntry: React.FC<Props> = ({ currentClusters, publicConfigClusters }) => {

  const { data, isLoading:getQuickEntriesLoading } = useAsync({ promiseFn: useCallback(async () => {
    return await api.getQuickEntries({});
  }, []) });

  // apps包含在哪些集群上可以创建app
  const { data:apps, isLoading:getAppsLoading } = useAsync({ promiseFn: useCallback(async () => {
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

  const [isEditable, setIsEditable] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  return (
    <DashboardSection
      style={{ marginBottom: "16px", minHeight: "320px", boxShadow: "#0000000D 0px 4px 4px 0px" }}
      title={ (
        <Localized id={p("quickEntry")} />
      )}
      extra={
        isEditable ? (
          <div>
            <EditButton
              style={{ marginRight:"20px" }}
              onClick={() => { setIsEditable(false); setIsFinished(true); }}
            >
              <Localized id={p("finish")} />
            </EditButton>
            <EditButton
              onClick={() => { setIsEditable(false); }}
            >
              <Localized id={p("cancel")} />
            </EditButton>
          </div>
        ) : (
          <EntryEditIcon onClick={() => { setIsEditable(true); setIsFinished(false); }}></EntryEditIcon>
        )}
    >
      <CardsContainer>
        {getQuickEntriesLoading || getAppsLoading ?
          <Spin /> : (
            <Sortable
              isEditable={isEditable}
              isFinished={isFinished}
              quickEntryArray={data?.quickEntries.length ? data?.quickEntries : defaultEntry }
              apps={apps ?? {}}
              currentClusters={currentClusters}
              publicConfigClusters={publicConfigClusters}
            ></Sortable>
          )}
      </CardsContainer>
    </DashboardSection>
  );
};
