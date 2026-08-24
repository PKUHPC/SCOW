import { queryToString } from "@scow/lib-web/build/utils/querystring";
import { message } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { useI18nTranslateToString } from "src/i18n";
import { CreateAppsTable } from "src/pageComponents/app/CreateAppsTable";
import { LaunchAppForm } from "src/pageComponents/app/LaunchAppForm";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const JobFormPageContainer = styled.div`
  margin: 8px;
  padding: 16px;
`;

interface AccountAvailabilityInfo {
  accountName: string;
  available: boolean;
  unavailableReasons: number[];
}

interface App {
  id: string;
  name: string;
  logoPath?: string;
  availableAccounts?: string[];
  accountAvailabilities?: AccountAvailabilityInfo[];
}

// 对应集群有授权了该应用的账户
const hasAccountAvailabilities = (app: App) => (app.accountAvailabilities?.length ?? 0) > 0;

export const CreateAppsIndexPage: NextPage = requireAuth(() => true)(() => {
  const router = useRouter();
  const clusterId = queryToString(router.query.clusterId);
  const appId = queryToString(router.query.appId);

  const { currentClusters, defaultCluster, setDefaultCluster } = useStore(ClusterInfoStore);
  const t = useI18nTranslateToString();
  const appUnauthorizedMessage = t("pageComp.app.createApps.appUnauthorized");

  const [selectedAppInfo, setSelectedAppInfo] = useState<App>();
  const [selectedCluster, _setSelectedCluster] = useState<string | undefined>(clusterId || defaultCluster?.id);

  const setSelectedCluster = useCallback(
    (cluster: string | undefined) => {
      _setSelectedCluster(cluster);
      setDefaultCluster(cluster ? currentClusters.find((c) => c.id === cluster) : undefined);
    },
    [currentClusters, setDefaultCluster],
  );
  const [filteredApps, setFilteredApps] = useState<App[]>();
  const [accountAppClusterMap, setAccountAppClusterMap] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (!selectedCluster && currentClusters.length > 0) {
      setSelectedCluster(defaultCluster?.id || currentClusters[0].id);
    }
  }, [currentClusters, selectedCluster, defaultCluster]);

  const { data: clusterAppsList, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      const clusterIds = currentClusters.map((cluster) => cluster.id);
      const appsResponse = await api.getAllClustersAvailableApps({ query: { clusterIds } });

      return appsResponse.results;
    }, []),
  });

  useEffect(() => {
    // 如果是带着appId从其它页面跳转过来的，直接到提交应用页面
    let appInfo: App | undefined;
    const allApps: App[] = [];

    clusterAppsList?.forEach((clusterApp) => {
      if (clusterId) {
        if (clusterId === clusterApp.clusterId) {
          allApps.push(...clusterApp.apps.filter(hasAccountAvailabilities));
        }
      } else {
        allApps.push(...clusterApp.apps.filter(hasAccountAvailabilities));
      }
    });

    if (appId) {
      appInfo = allApps?.find((app) => app.id === appId);
      const clusterApps = clusterAppsList?.find((clusterApp) => clusterApp.clusterId === clusterId);
      if (clusterApps && !appInfo) {
        message.error({
          content: appUnauthorizedMessage,
          key: `app-unauthorized-${clusterId}-${appId}`,
        });
      }
    }

    setSelectedAppInfo(appInfo);
  }, [appId, appUnauthorizedMessage, clusterAppsList, clusterId]);

  useEffect(() => {
    if (selectedCluster) {
      const clusterData = clusterAppsList?.find((item) => item.clusterId === selectedCluster);
      if (clusterData) {
        const appInfo = clusterData.apps.find((app) => app.id === selectedAppInfo?.id);
        setSelectedAppInfo(appInfo);
      }
    }
  }, [selectedCluster]);

  useEffect(() => {
    // 构建 account+app → clusters 的复合 map，精确描述三者关系
    const accountAppToClustersMap = new Map<string, Set<string>>();
    clusterAppsList?.forEach((clusterData) => {
      clusterData.apps?.forEach((app) => {
        app.availableAccounts?.forEach((account) => {
          const key = `${account}::${app.id}`;
          if (!accountAppToClustersMap.has(key)) {
            accountAppToClustersMap.set(key, new Set());
          }
          accountAppToClustersMap.get(key)!.add(clusterData.clusterId);
        });
      });
    });
    const convertedAccountAppMap = new Map<string, string[]>();
    accountAppToClustersMap.forEach((clusters, key) => {
      convertedAccountAppMap.set(key, Array.from(clusters));
    });
    setAccountAppClusterMap(convertedAccountAppMap);
  }, [clusterAppsList]);

  useEffect(() => {
    let result: App[] = [];

    if (selectedCluster) {
      // 如果选择了集群，只返回该集群的 apps
      const clusterData = clusterAppsList?.find((item) => item.clusterId === selectedCluster);
      if (clusterData) {
        result = clusterData.apps.filter(hasAccountAvailabilities);
      }
    } else {
      // 如果没有选择集群，返回所有去重的 apps
      const appMap = new Map<string, App>();

      clusterAppsList?.forEach((clusterData) => {
        if (clusterData.apps && Array.isArray(clusterData.apps)) {
          clusterData.apps.forEach((app) => {
            if (!appMap.has(app.id) && hasAccountAvailabilities(app)) {
              appMap.set(app.id, app);
            }
          });
        }
      });

      result = Array.from(appMap.values());
    }

    setFilteredApps(result);
  }, [clusterAppsList, selectedCluster]);

  return (
    <>
      <Head title={t("pages.apps.createApps.title")} />
      {selectedAppInfo ? (
        <JobFormPageContainer>
          <LaunchAppForm
            appInfo={selectedAppInfo}
            setSelectedAppInfo={setSelectedAppInfo}
            preSelectedCluster={selectedCluster}
            setSelectedCluster={setSelectedCluster}
            accountAppClusterMap={accountAppClusterMap}
          />
        </JobFormPageContainer>
      ) : (
        <>
          {/* 去掉了BaseLayout中的padding和margin */}
          <div style={{ paddingLeft: 24, paddingTop: 24 }}>
            <PageTitle titleText={t("pages.apps.createApps.title")} />
          </div>
          <CreateAppsTable
            allApps={filteredApps || []}
            isLoading={isLoading}
            selectedCluster={selectedCluster}
            setSelectedCluster={setSelectedCluster}
            setSelectedAppInfo={setSelectedAppInfo}
          />
        </>
      )}
    </>
  );
});
export default CreateAppsIndexPage;
