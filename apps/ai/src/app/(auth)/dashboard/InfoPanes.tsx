import React, { useEffect } from "react";
import { styled, useTheme } from "styled-components";

import { InfoPane } from "./InfoPane"; ;
import { Cluster } from "@scow/config/build/type";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { Card, Col, Row } from "antd";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { PlatformOverview,SummaryClusterInfo } from "src/models/Cluster";

import JobInfo from "./NodeRange";

interface Props {
  selectItem: SummaryClusterInfo | PlatformOverview | undefined;
  loading: boolean;
  activeTabKey: string;
  onTabChange: (key: string) => void;
  currentClusters: Cluster[];
}

const InfoPaneContainer = styled.div`
`;

const colors = {
  // 节点使用率颜色
  nodeUtilizationAvailable:"#ABA2E1",
  nodeUtilizationNotavailable:"#CFCAEE",
  nodeUtilizationRunning:"#6959CA",

  // CPU核心使用率颜色
  cpuAvailable:"#78BAC3",
  cpunotAvailable:"#B0D6DC",
  cpuRunning:"#4DA2AE",

  // GPU核心使用率颜色
  gpuRunning:"#BED32A",
  gpuAvailable:"#D2E269",
  gpunotAvailable:"#EBF1BE",

  // 作业字体颜色
  runningJob:"#D1CB5B",
  queuing:"#A58E74",
};

export const InfoPanes: React.FC<Props> = ({ selectItem, loading, activeTabKey,
  onTabChange, currentClusters }) => {

  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const p = prefix("app.dashboard.infoPanes.");

  const theme = useTheme();
  const showPlatformOverview = currentClusters.length > 1;

  let clusterCardsList;
  // card的每一项
  if (!showPlatformOverview) {
    clusterCardsList = currentClusters.map((x) => ({
      key:x.id,
      tab:typeof (x.name) == "string" ? x.name : getI18nConfigCurrentText(x.name, languageId),
    }));
  } else {
    clusterCardsList = [
      {
        key:"platformOverview",
        tab:
        <div style={{ width:"max-content", height:"40px",
          textAlign: "center", lineHeight:"40px",
          color:`${activeTabKey === "platformOverview" ? "#FFF" : "#000"}`,
          background:`${activeTabKey === "platformOverview" ? theme.token.colorPrimary : "transparent"}`,
          borderRadius:"5px",
          fontWeight:"700",
          paddingLeft:"20px",
          paddingRight:"20px",
        }}
        >
          {t(p("platformOverview"))}
        </div>,
      },
      ...currentClusters.map((x) => ({
        key:x.id,
        tab:typeof (x.name) == "string" ? x.name : getI18nConfigCurrentText(x.name, languageId),
      })),
    ];
  }

  // 初始化单集群默认选中项，避免 render 阶段 setState
  useEffect(() => {
    if (!showPlatformOverview) {
      const onlyClusterId = currentClusters[0]?.id;
      if (onlyClusterId && activeTabKey !== onlyClusterId) {
        onTabChange(onlyClusterId);
      }
    }
  }, [showPlatformOverview, currentClusters, activeTabKey, onTabChange]);

  const { nodeCount, runningNodeCount, idleNodeCount, notAvailableNodeCount,
    cpuCoreCount, runningCpuCount, idleCpuCount, notAvailableCpuCount,
    gpuCoreCount, runningGpuCount, idleGpuCount, notAvailableGpuCount, runningJobCount, pendingJobCount,
  } = selectItem ?? {
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
    runningJobCount: 0,
    pendingJobCount: 0,
  };

  return (
    <Card
      style={{ width:"100%" }}
      tabList={clusterCardsList}
      activeTabKey={activeTabKey}
      onTabChange={onTabChange}
    >
      <Row justify="space-between" wrap gutter={[50, 50]}>
        <Col xs={24} md={12} xl={gpuCoreCount > 0 ? 6 : 8}>
          <InfoPaneContainer>
            <InfoPane
              loading={loading}
              tag={{ itemName:t(p("nodeCount")), num:nodeCount, subName:t(p("total")) }}
              paneData={ [{ itemName:t(p("running")), num:runningNodeCount, color:colors.nodeUtilizationRunning },
                { itemName:t(p("idle")), num:idleNodeCount, color:colors.nodeUtilizationAvailable },
                { itemName:t(p("notAvailable")), num:notAvailableNodeCount || 0,
                  color:colors.nodeUtilizationNotavailable }]}
            ></InfoPane>
          </InfoPaneContainer>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <InfoPaneContainer>
            <InfoPane
              loading={loading}
              tag={ { itemName:"CPU", num:cpuCoreCount, subName:t(p("cpuCoreCount")) } }
              paneData={[
                { itemName:t(p("running")), num:runningCpuCount, color:colors.cpuRunning },
                { itemName:t(p("idle")), num:idleCpuCount, color:colors.cpuAvailable },
                { itemName:t(p("notAvailable")), num:notAvailableCpuCount || 0, color:colors.cpunotAvailable },
              ]}
            ></InfoPane>
          </InfoPaneContainer>
        </Col>
        {gpuCoreCount > 0 && (
          <Col xs={24} md={12} xl={gpuCoreCount > 0 ? 6 : 8}>
            <InfoPaneContainer>
              <InfoPane
                loading={loading}
                tag={{ itemName: "GPU", num: gpuCoreCount, subName: t(p("gpuCoreCount")) }}
                paneData={[
                  { itemName: t(p("running")), num: runningGpuCount, color: colors.gpuRunning },
                  { itemName: t(p("idle")), num: idleGpuCount, color: colors.gpuAvailable },
                  { itemName: t(p("notAvailable")), num: notAvailableGpuCount || 0, color: colors.gpunotAvailable },
                ]}
              ></InfoPane>
            </InfoPaneContainer>
          </Col>
        )}
        <Col xs={24} md={12} xl={gpuCoreCount > 0 ? 6 : 8}>
          <InfoPaneContainer>
            <JobInfo
              runningJobs={`${runningJobCount}`}
              pendingJobs={`${pendingJobCount}`}
              loading={loading}
              display={!(runningJobCount === undefined && pendingJobCount === undefined)}
            />
          </InfoPaneContainer>
        </Col>
      </Row>
    </Card>
  );
};
