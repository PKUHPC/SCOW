import { ClusterActivationStatus } from "@scow/config/build/type";
import { RefreshLink, useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { NextPage } from "next";
import { useCallback } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterConnectionStatus } from "src/models/cluster";
import { PlatformRole } from "src/models/User";
import { ClusterManagementTable } from "src/pageComponents/admin/ClusterManagementTable";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";
import { Head } from "src/utils/head";


export interface CombinedClusterInfo {
  clusterId: string,
  connectionStatus: ClusterConnectionStatus,
  totalMemMb: number,
  totalNodeCount: number,
  totalCpuCoreCount: number,
  totalGpuCount: number,
  activationStatus: ClusterActivationStatus,
  deactivationComment?: string,
  operatorId?: string,
  operatorName?: string,
  updateTime: string,
  hpcEnabled?: boolean,
}

export const ClusterManagementPage: NextPage =
  requireAuth((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(() => {

    const t = useI18nTranslateToString();
    const languageId = useI18n().currentLanguage.id;
    const p = prefix("page.admin.resourceManagement.clusterManagement.");

    const { publicConfigClusters, clusterSortedIdList, setActivatedClusters } = useStore(ClusterInfoStore);

    const promiseFn = useCallback(async () => {

      const [connectionClustersData, dbClustersData] = await Promise.all([
        api.getClustersConnectionInfo({}),
        api.getClustersRuntimeInfo({ query: {} }),
      ]);

      const combinedClusterList: CombinedClusterInfo[] = [];
      const currentActivatedClusters: Record<string, Cluster> = {};
      // sort by cluster's priority
      const sortedConnectionClustersData = connectionClustersData.results.sort((a, b) => {
        const sortedIds = clusterSortedIdList;
        return sortedIds.indexOf(a.clusterId) - sortedIds.indexOf(b.clusterId);
      });
      sortedConnectionClustersData.forEach((cluster) => {
        const currentCluster = dbClustersData.results.find((dbCluster) => dbCluster.clusterId === cluster.clusterId);
        if (currentCluster) {
          const combinedData = {
            ...cluster,
            ...currentCluster,
          } as CombinedClusterInfo;
          combinedClusterList.push(combinedData);
          if (combinedData.activationStatus === ClusterActivationStatus.ACTIVATED) {
            currentActivatedClusters[combinedData.clusterId] = publicConfigClusters[combinedData.clusterId];
          }
        }
      });
      setActivatedClusters(currentActivatedClusters);
      return combinedClusterList;

    }, []);

    const [refreshToken, update] = useRefreshToken();

    const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

    return (
      <div>
        <Head title={t(p("title"))} />
        <PageTitle titleText={t(p("title"))}>
          <RefreshLink refresh={update} languageId={languageId} />
        </PageTitle>
        <ClusterManagementTable
          data={data}
          isLoading={isLoading}
          reload={reload}
        />
      </div>
    );

  });

export default ClusterManagementPage;
