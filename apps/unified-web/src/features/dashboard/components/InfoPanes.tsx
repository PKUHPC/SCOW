import { Card, Col, Row } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { InfoPane } from "src/features/dashboard/components/InfoPane";
import { NodeRange } from "src/features/dashboard/components/NodeRange";
import type { DashboardCluster, DashboardClusterSummary, PlatformOverview } from "src/features/dashboard/types";
import { getLocalizedText } from "src/features/dashboard/utils";
import { styled, useTheme } from "styled-components";

interface Props {
  selectItem: DashboardClusterSummary | PlatformOverview | undefined;
  loading: boolean;
  activeTabKey: string;
  onTabChange: (key: string) => void;
  currentClusters: DashboardCluster[];
  hasFailedClusters?: boolean;
}

const InfoPaneContainer = styled.div``;

const colors = {
  nodeUtilizationAvailable: "#ABA2E1",
  nodeUtilizationNotavailable: "#CFCAEE",
  nodeUtilizationRunning: "#6959CA",
  cpuAvailable: "#78BAC3",
  cpunotAvailable: "#B0D6DC",
  cpuRunning: "#4DA2AE",
  gpuRunning: "#BED32A",
  gpuAvailable: "#D2E269",
  gpunotAvailable: "#EBF1BE",
};

export function InfoPanes({ selectItem, loading, activeTabKey, onTabChange, currentClusters, hasFailedClusters }: Props) {
  const { i18n, t } = useTranslation("dashboard");
  const theme = useTheme();
  const showPlatformOverview = currentClusters.length > 1 || Boolean(hasFailedClusters);

  useEffect(() => {
    if (!showPlatformOverview) {
      const onlyClusterId = currentClusters[0]?.id;
      if (onlyClusterId && activeTabKey !== onlyClusterId) onTabChange(onlyClusterId);
    }
  }, [activeTabKey, currentClusters, onTabChange, showPlatformOverview]);

  const clusterCardsList = showPlatformOverview
    ? [
        {
          key: "platformOverview",
          tab: (
            <div
              style={{
                width: "max-content",
                height: "40px",
                textAlign: "center",
                lineHeight: "40px",
                color: activeTabKey === "platformOverview" ? "#FFF" : "#000",
                background: activeTabKey === "platformOverview" ? theme.token.colorPrimary : "transparent",
                borderRadius: "5px",
                paddingLeft: "20px",
                paddingRight: "20px",
              }}
            >
              {t("dashboard.infoPanes.platformOverview", "平台概览")}
            </div>
          ),
        },
        ...currentClusters.map((cluster) => ({
          key: cluster.id,
          tab: getLocalizedText(cluster.name, i18n.language),
        })),
      ]
    : currentClusters.map((cluster) => ({
        key: cluster.id,
        tab: getLocalizedText(cluster.name, i18n.language),
      }));

  const {
    runningNodeCount = 0,
    idleNodeCount = 0,
    notAvailableNodeCount = 0,
    runningCpuCount = 0,
    idleCpuCount = 0,
    notAvailableCpuCount = 0,
    gpuCoreCount = 0,
    runningGpuCount = 0,
    idleGpuCount = 0,
    notAvailableGpuCount = 0,
    runningJobCount = 0,
    pendingJobCount = 0,
  } = selectItem ?? {};
  const hasGpu = gpuCoreCount > 0;
  const paneXlSpan = hasGpu ? 6 : 8;

  return (
    <Card
      style={{ width: "100%", boxShadow: "#0000000D 0px 4px 4px 0px" }}
      tabList={clusterCardsList}
      activeTabKey={activeTabKey}
      onTabChange={onTabChange}
    >
      <Row wrap gutter={[50, 50]}>
        <Col xs={24} md={12} lg={paneXlSpan} xl={paneXlSpan}>
          <InfoPaneContainer>
            <InfoPane
              loading={loading}
              tag={{
                itemName: t("dashboard.infoPanes.node", "节点"),
                subName: t("dashboard.infoPanes.totalNodes", "总数"),
              }}
              paneData={[
                {
                  itemName: t("dashboard.infoPanes.running", "运行中"),
                  num: runningNodeCount,
                  color: colors.nodeUtilizationRunning,
                },
                {
                  itemName: t("dashboard.infoPanes.idle", "空闲"),
                  num: idleNodeCount,
                  color: colors.nodeUtilizationAvailable,
                },
                {
                  itemName: t("dashboard.infoPanes.notAvailable", "不可用"),
                  num: notAvailableNodeCount,
                  color: colors.nodeUtilizationNotavailable,
                },
              ]}
            />
          </InfoPaneContainer>
        </Col>
        <Col xs={24} md={12} lg={paneXlSpan} xl={paneXlSpan}>
          <InfoPaneContainer>
            <InfoPane
              loading={loading}
              tag={{ itemName: "CPU", subName: t("dashboard.infoPanes.totalCores", "总核心数") }}
              paneData={[
                {
                  itemName: t("dashboard.infoPanes.running", "运行中"),
                  num: runningCpuCount,
                  color: colors.cpuRunning,
                },
                {
                  itemName: t("dashboard.infoPanes.idle", "空闲"),
                  num: idleCpuCount,
                  color: colors.cpuAvailable,
                },
                {
                  itemName: t("dashboard.infoPanes.notAvailable", "不可用"),
                  num: notAvailableCpuCount,
                  color: colors.cpunotAvailable,
                },
              ]}
            />
          </InfoPaneContainer>
        </Col>
        {hasGpu ? (
          <Col xs={24} md={12} lg={paneXlSpan} xl={paneXlSpan}>
            <InfoPaneContainer>
              <InfoPane
                loading={loading}
                hideWhenEmpty
                tag={{
                  itemName: t("dashboard.infoPanes.gpu", "加速卡"),
                  subName: t("dashboard.infoPanes.totalCards", "总卡数"),
                }}
                paneData={[
                  {
                    itemName: t("dashboard.infoPanes.running", "运行中"),
                    num: runningGpuCount,
                    color: colors.gpuRunning,
                  },
                  {
                    itemName: t("dashboard.infoPanes.idle", "空闲"),
                    num: idleGpuCount,
                    color: colors.gpuAvailable,
                  },
                  {
                    itemName: t("dashboard.infoPanes.notAvailable", "不可用"),
                    num: notAvailableGpuCount,
                    color: colors.gpunotAvailable,
                  },
                ]}
              />
            </InfoPaneContainer>
          </Col>
        ) : null}
        <Col xs={24} md={12} lg={paneXlSpan} xl={paneXlSpan}>
          <InfoPaneContainer>
            <NodeRange
              runningJobs={`${runningJobCount}`}
              pendingJobs={`${pendingJobCount}`}
              loading={loading}
              display={true}
            />
          </InfoPaneContainer>
        </Col>
      </Row>
    </Card>
  );
}
