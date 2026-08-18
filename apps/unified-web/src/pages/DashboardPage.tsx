import { Alert, Col, Row } from "antd";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMetadataQuery } from "src/api/metadata";
import { aggregatePlatformOverview } from "src/features/dashboard/aggregate";
import { OverviewTable } from "src/features/dashboard/components/OverviewTable";
import { NotificationCard } from "src/features/dashboard/components/NotificationCard";
import { QuickEntry } from "src/features/dashboard/components/QuickEntry";
import { DisplayModeContext } from "src/features/dashboard/DisplayModeContext";
import { useDashboardQuery } from "src/features/dashboard/queries";
import type { DashboardSource } from "src/features/dashboard/types";
import { styled } from "styled-components";

const DashboardPageContent = styled.div`
  flex: 1;
`;

const NotificationCol = styled(Col)`
  padding-bottom: 16px;
`;

export function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const metadataQuery = useMetadataQuery();
  const enabledSources = useMemo(
    () =>
      ([
        ...(metadataQuery.data?.components.portal ? (["portal"] as const) : []),
        ...(metadataQuery.data?.components.ai ? (["ai"] as const) : []),
      ] satisfies DashboardSource[]),
    [metadataQuery.data?.components.ai, metadataQuery.data?.components.portal],
  );
  const sourceBasePaths = useMemo(
    () => ({
      portal: metadataQuery.data?.components.portal ?? "",
      ai: metadataQuery.data?.components.ai ?? "",
    }),
    [metadataQuery.data?.components.ai, metadataQuery.data?.components.portal],
  );
  const dashboardQuery = useDashboardQuery(enabledSources);
  const dashboard = dashboardQuery.data;
  const notificationEnabled = metadataQuery.data ? Boolean(metadataQuery.data.components.notification) : true;
  const clusterInfo = useMemo(
    () =>
      dashboard?.summaries.flatMap((cluster) =>
        cluster.partitions.map((partition) => ({ clusterId: cluster.clusterId, ...partition })),
      ) ?? [],
    [dashboard?.summaries],
  );
  const platformOverview = useMemo(
    () => aggregatePlatformOverview(dashboard?.summaries ?? []),
    [dashboard?.summaries],
  );

  return (
    <DashboardPageContent>
      <Row gutter={[16, 0]} wrap>
        <Col xs={24} md={notificationEnabled ? 17 : 24} xl={notificationEnabled ? 17 : 24}>
          <QuickEntry enabledSources={enabledSources} sourceBasePaths={sourceBasePaths} />
        </Col>
        {notificationEnabled ? (
          <NotificationCol xs={24} md={7} xl={7}>
            <NotificationCard />
          </NotificationCol>
        ) : null}
      </Row>
      {dashboard && (dashboard.failedSources.length > 0 || dashboard.failedClusters.length > 0) ? (
        <Alert
          showIcon
          type="warning"
          style={{ marginBottom: 16 }}
          message={t("dashboard.partialLoadFailed", "部分集群数据加载失败，已展示其余可用集群。")}
        />
      ) : null}
      <DisplayModeContext.Provider value={dashboard?.isFullDisplayMode ?? true}>
        <OverviewTable
          isLoading={metadataQuery.isLoading || dashboardQuery.isLoading}
          clusterInfo={clusterInfo}
          failedClusters={dashboard?.failedClusters ?? []}
          currentClusters={dashboard?.clusters ?? []}
          platformOverview={platformOverview}
          summaryClusterInfo={dashboard?.summaries ?? []}
        />
      </DisplayModeContext.Provider>
    </DashboardPageContent>
  );
}
