import { DisplayModeContext } from "@scow/lib-web/build/layouts/DisplayModeContext";
import { Col, Row } from "antd";
import { NextPage } from "next";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { useI18nTranslateToString } from "src/i18n";
import { PlatformOverview } from "src/models/cluster";
import { NotificationCard } from "src/pageComponents/dashboard/NotificationCard";
import { OverviewTable } from "src/pageComponents/dashboard/OverviewTable";
import { QuickEntry } from "src/pageComponents/dashboard/QuickEntry";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { UserStore } from "src/stores/UserStore";
import { publicConfig } from "src/utils/config";
import { Head } from "src/utils/head";
import { styled } from "styled-components";

const createEmptyOverview = (): PlatformOverview => ({
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

const NotificationCol = styled(Col)`
padding-bottom: 16px;
`;

const DashboardPageContent = styled.div``;

export const DashboardPage: NextPage = requireAuth(() => true)(() => {
  const userStore = useStore(UserStore);
  const router = useRouter();

  useEffect(() => {
    router.replace(router.asPath);
  }, [userStore.user]);

  const t = useI18nTranslateToString();

  const { currentClusters } = useStore(ClusterInfoStore);

  // 判断是否显示全部资源
  const { user } = useStore(UserStore);

  const isFullDisplayMode = useMemo(() => {
    return user?.isAdmin || publicConfig.DASHBOARD_USER_DISPLAY_MODE === "full";
  }, [user]);

  const { data, isLoading } = useAsync({
    promiseFn: useCallback(async () => {
      // 检查 currentClusters 是否为空
      if (!currentClusters || currentClusters.length === 0) {
        return {
          clustersInfo: [],
          failedClusters: [],
          platformOverview: createEmptyOverview(),
          successfulClusters: [],
        };
      }

      const clusterIds = currentClusters.map((cluster) => cluster.id);

      const summaryClusterInfoResponse = await api.getAllSummaryClustersInfo({ query: {
        clusterIds, isFullDisplayMode } }).httpError(500, () => []);

      const summaryClusterInfoResults = summaryClusterInfoResponse.results;

      const successfulClusterNames = new Set(summaryClusterInfoResults.map((result) => result.clusterId));
      const failedClusters = currentClusters.filter((cluster) => !successfulClusterNames.has(cluster.id));
      const successfulClusters = currentClusters.filter((cluster) => successfulClusterNames.has(cluster.id));

      // 构建集群分区信息，包含使用率计算
      const clustersInfo = summaryClusterInfoResults.flatMap((cluster) =>
        cluster.partitions.map((partition) => ({
          clusterId: cluster.clusterId,
          ...partition,
        })),
      );

      const platformOverview: PlatformOverview = createEmptyOverview();

      // 累加平台总览数据
      summaryClusterInfoResults.forEach((cluster) => {
        platformOverview.nodeCount += cluster.nodeCount;
        platformOverview.runningNodeCount += cluster.runningNodeCount;
        platformOverview.idleNodeCount += cluster.idleNodeCount;
        platformOverview.notAvailableNodeCount += (cluster.notAvailableNodeCount || 0);
        platformOverview.runningJobCount += cluster.runningJobCount;
        platformOverview.pendingJobCount += cluster.pendingJobCount;
        platformOverview.cpuCoreCount += cluster.cpuCoreCount;
        platformOverview.runningCpuCount += cluster.runningCpuCount;
        platformOverview.idleCpuCount += cluster.idleCpuCount;
        platformOverview.notAvailableCpuCount += (cluster.notAvailableCpuCount || 0);
        platformOverview.gpuCoreCount += cluster.gpuCoreCount;
        platformOverview.runningGpuCount += cluster.runningGpuCount;
        platformOverview.idleGpuCount += cluster.idleGpuCount;
        platformOverview.notAvailableGpuCount += (cluster.notAvailableGpuCount || 0);
      });

      return {
        clustersInfo,
        failedClusters,
        platformOverview,
        successfulClusters,
        summaryClusterInfoResults,
      };
    }, [currentClusters]),
  });

  return (
    <DashboardPageContent>
      <Head title={t("pages.dashboard.title")} />
      <Row gutter={[16, 16]} wrap={true}>
        <Col sm={24} md={publicConfig.NOTIF_ENABLED ? 17 : 24} xl={publicConfig.NOTIF_ENABLED ? 17 : 24}>
          <QuickEntry />
        </Col>
        {publicConfig.NOTIF_ENABLED && (
          <NotificationCol md={7} xl={7}>
            <NotificationCard />
          </NotificationCol>
        )}
      </Row>
      <DisplayModeContext.Provider value={isFullDisplayMode}>
        <OverviewTable
          isLoading={isLoading}
          clusterInfo={data?.clustersInfo ? data.clustersInfo.map((item, idx) => ({ ...item, id: idx })) : []}
          failedClusters={data?.failedClusters ?? []}
          currentClusters={currentClusters}
          platformOverview={data?.platformOverview}
          successfulClusters={data?.successfulClusters}
          summaryClusterInfo={data?.summaryClusterInfoResults ?? []}
        />
      </DisplayModeContext.Provider>
    </DashboardPageContent>
  );
});

export default DashboardPage;
