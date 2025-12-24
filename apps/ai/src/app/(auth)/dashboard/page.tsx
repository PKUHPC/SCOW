"use client";

import { DisplayModeContext } from "@scow/lib-web/build/layouts/DisplayModeContext";
import { SummaryPartitionInfo } from "@scow/protos/build/portal/config";
import { Col, Row } from "antd";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/(auth)/context";
import { useI18nTranslateToString } from "src/i18n";
import { PlatformOverview } from "src/models/Cluster";
import { useDocumentTitle } from "src/utils/head";
import { trpc } from "src/utils/trpc";
import { styled } from "styled-components";

import { NotificationCard } from "./NotificationCard";
import { OverviewTable } from "./OverviewTable";
import { QuickEntry } from "./QuickEntry";

const DashboardPageContent = styled.div``;

interface ClusterPartitionInfo extends SummaryPartitionInfo {
  clusterId: string;
}

const initialPlatformOverview: PlatformOverview = {
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
};

const NotificationCol = styled(Col)`
  padding-bottom: 16px;
`;

export default function Page() {
  const t = useI18nTranslateToString();

  const { publicConfig: { CLUSTERS: currentClusters, DASHBOARD_USER_DISPLAY_MODE },
    publicConfig, user } = usePublicConfig();

  // 判断是否展示全部资源
  const isFullDisplayMode = useMemo(() => {

    const isTenantAdmin = user.tenantRoles?.includes(0) ?? false;
    const isPlatformAdmin = user.platformRoles?.includes(0) ?? false;
    const isAdmin = isTenantAdmin || isPlatformAdmin;

    return isAdmin || DASHBOARD_USER_DISPLAY_MODE === "full";

  }, [user]);

  // 使用批量接口获取所有集群信息
  const clusterIds = currentClusters.map((cluster) => cluster.id);


  const { data: allSummaryClusters, isLoading } = trpc.dashboard.getAllSummaryClustersInfo.useQuery(
    { clusterIds, isFullDisplayMode, userId: user.identityId },
    { enabled: clusterIds.length > 0 },
  );

  // 加载失败的集群、成功的集群、集群信息、平台概览、以及集群概览。
  const [failedClusters, setFailedClusters] = useState<typeof currentClusters>([]);
  const [successfulClusters, setSuccessfulClusters] = useState<typeof currentClusters>([]);
  const [clustersInfo, setClustersInfo] = useState<ClusterPartitionInfo[]>([]);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview>({ ...initialPlatformOverview });

  useEffect(() => {
    if (!isLoading && allSummaryClusters) {
      // 集群信息

      const successfulClusterIds = new Set(
        allSummaryClusters.map((c) => c.clusterId),
      );

      const successfulClusters = currentClusters.filter((cluster) =>
        successfulClusterIds.has(cluster.id),
      );

      const failedClusters = currentClusters.filter(
        (cluster) => !successfulClusterIds.has(cluster.id),
      );

      setFailedClusters(failedClusters);
      setSuccessfulClusters(successfulClusters);

      // 存储各集群各队列分区的详细信息
      const clustersInfo = allSummaryClusters
        .flatMap((cluster) =>
          cluster.partitions.map((partition) => ({
            clusterId: cluster.clusterId,
            ...partition,
            cpuCoreCount: partition.cpuCoreCount || 0,
            gpuCoreCount: partition.gpuCoreCount || 0,
          })),
        );

      // 整合各集群的各分区信息，计算集群概览的聚合数据,
      allSummaryClusters.forEach((cluster) => {

        // 更新平台概览 platformOverview 的数值
        platformOverview.nodeCount += cluster.nodeCount;
        platformOverview.runningNodeCount += cluster.runningNodeCount;
        platformOverview.idleNodeCount += cluster.idleNodeCount;
        platformOverview.notAvailableNodeCount += (cluster.notAvailableNodeCount || 0);
        platformOverview.cpuCoreCount += cluster.cpuCoreCount;
        platformOverview.runningCpuCount += cluster.runningCpuCount;
        platformOverview.idleCpuCount += cluster.idleCpuCount;
        platformOverview.notAvailableCpuCount += (cluster.notAvailableCpuCount || 0);
        platformOverview.gpuCoreCount += cluster.gpuCoreCount;
        platformOverview.runningGpuCount += cluster.runningGpuCount;
        platformOverview.idleGpuCount += cluster.idleGpuCount;
        platformOverview.notAvailableGpuCount += (cluster.notAvailableGpuCount || 0);
        platformOverview.runningJobCount += cluster.runningJobCount;
        platformOverview.pendingJobCount += cluster.pendingJobCount;

      });

      setFailedClusters(failedClusters);
      setSuccessfulClusters(successfulClusters);
      setClustersInfo(clustersInfo);
      setPlatformOverview(platformOverview);

    }

  }, [
    isLoading, currentClusters, allSummaryClusters,
  ]);

  useDocumentTitle(t("routes.dashboard"));

  return (
    <DashboardPageContent>
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
          clusterInfo={clustersInfo ? clustersInfo.map((item) => ({ ...item })) : []}
          failedClusters={failedClusters}
          currentClusters={currentClusters}
          platformOverview={platformOverview}
          successfulClusters={successfulClusters}
          summaryClusterInfo={allSummaryClusters ?? []}
        />
      </DisplayModeContext.Provider>
    </DashboardPageContent>
  );
}
