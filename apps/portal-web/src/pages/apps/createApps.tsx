import { queryToString } from "@scow/lib-web/build/utils/querystring";
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

interface App {
  id: string;
  name: string;
  logoPath?: string;
  availableAccounts?: string[];
}

export const CreateAppsIndexPage: NextPage = requireAuth(() => true)(() => {
  const router = useRouter();
  const clusterId = queryToString(router.query.clusterId);
  const appId = queryToString(router.query.appId);

  const { currentClusters } = useStore(ClusterInfoStore);
  const t = useI18nTranslateToString();

  const [selectedAppInfo, setSelectedAppInfo] = useState<App>();
  const [selectedCluster, setSelectedCluster] = useState<string | undefined>(clusterId);
  const [filteredApps, setFilteredApps] = useState<App[]>();
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [allAvailableAccounts, setAllAvailableAccounts] = useState<string[]>([]);
  const [accountAppClusterMap, setAccountAppClusterMap] = useState<Map<string, string[]>>(new Map());

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
          allApps.push(...clusterApp.apps);
        }
      } else {
        allApps.push(...clusterApp.apps);
      }
    });

    if (appId) {
      appInfo = allApps?.find((app) => app.id === appId);
    }

    setSelectedAppInfo(appInfo);
  }, [clusterAppsList]);

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

    // 计算所有 app 可用账户的并集
    const allAccountsSet = new Set<string>();
    clusterAppsList?.forEach((clusterData) => {
      clusterData.apps.forEach((app) => {
        app.availableAccounts?.forEach((account) => allAccountsSet.add(account));
      });
    });
    setAllAvailableAccounts(Array.from(allAccountsSet));
  }, [clusterAppsList]);

  useEffect(() => {
    let result: App[] = [];

    if (selectedCluster) {
      // 如果选择了集群，只返回该集群的 apps
      const clusterData = clusterAppsList?.find((item) => item.clusterId === selectedCluster);
      if (clusterData) {
        result = clusterData.apps;
      }
    } else {
      // 如果没有选择集群，返回所有去重的 apps
      const appMap = new Map<string, App>();

      clusterAppsList?.forEach((clusterData) => {
        if (clusterData.apps && Array.isArray(clusterData.apps)) {
          clusterData.apps.forEach((app) => {
            if (!appMap.has(app.id)) {
              appMap.set(app.id, app);
            }
          });
        }
      });

      result = Array.from(appMap.values());
    }

    setFilteredApps(result);
  }, [clusterAppsList, selectedCluster]);

  useEffect(() => {
    if (selectedCluster && selectedAppInfo) {
      setAvailableAccounts(selectedAppInfo.availableAccounts || []);
    }
  }, [selectedAppInfo, selectedCluster]);

  return (
    <>
      <Head title={t("pages.apps.createApps.title")} />
      {selectedAppInfo ? (
        <LaunchAppForm
          appInfo={selectedAppInfo}
          setSelectedAppInfo={setSelectedAppInfo}
          preSelectedCluster={selectedCluster}
          setSelectedCluster={setSelectedCluster}
          availableAccounts={availableAccounts}
          allAvailableAccounts={allAvailableAccounts}
          accountAppClusterMap={accountAppClusterMap}
        />
      ) : (
        <>
          <PageTitle titleText={t("pages.apps.createApps.title")} />
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
