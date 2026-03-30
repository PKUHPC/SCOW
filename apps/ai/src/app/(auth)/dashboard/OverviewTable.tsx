import { DisplayModeContext } from "@scow/lib-web/build/layouts/DisplayModeContext";
import { compareWithUndefined } from "@scow/lib-web/build/utils/dashboard";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { SummaryPartitionInfo,SummaryPartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";
import { Table, Tag } from "antd";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { useDarkMode } from "src/layouts/darkMode";
import { PlatformOverview, SummaryClusterInfo } from "src/models/Cluster";
import { Cluster } from "src/utils/cluster";
import { styled } from "styled-components";

import { CustomProgress } from "./CustomProgress";
import { DashboardSection } from "./DashboardSection";
import { InfoPanes } from "./InfoPanes";

export interface ClusterInfo extends SummaryPartitionInfo {
  clusterId: string;
}

interface Props {
  clusterInfo: ClusterInfo[];
  failedClusters: Cluster[];
  currentClusters: Cluster[];
  isLoading: boolean;
  summaryClusterInfo: SummaryClusterInfo[];
  platformOverview?: PlatformOverview | undefined;
}

interface InfoProps {
  id: number;
  partitionName?: string;
  nodeCount: number;
  cpuCoreCount: number,
  gpuCoreCount: number,
  pendingJobCount: number;
  cpuUsage: number;
  gpuUsage?: number;
  nodeUsage: number;
  partitionStatus?: SummaryPartitionInfo_PartitionStatus;
}

interface TableProps {
  clusterId: string;
  info?: InfoProps
}

const Container = styled.div`
  /* 修改滚动条样式 */
  .ant-table-body{
    &::-webkit-scrollbar {
    width: 5px !important;
    overflow-y: auto !important;
    }
    &::-webkit-scrollbar-thumb {
    border-radius: 5px !important;
    background: #ccc !important;
    }
    &::-webkit-scrollbar-track {
    -webkit-box-shadow: 0 !important;
    border-radius: 0 !important;
    background: #fff !important;
    }
  }

  .ant-table-title {
    padding-left: 24px !important;
    display: flex;
    align-items: center;
    justify-content: start;
    font-size: 16px;
  }

  .rowBgColor{
    /* 去除鼠标经过默认的背景颜色 */
    td {
      background: none !important;
    }
  }
`;

export const OverviewTable: React.FC<Props> = ({ clusterInfo, failedClusters,
  currentClusters, isLoading, summaryClusterInfo, platformOverview }) => {

  const { dark } = useDarkMode();
  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();
  const p = prefix("app.dashboard.overviewTable.");

  const [selectId, setSelectId] = useState<string | undefined>(undefined);

  const selectItem = useMemo(
    () => clusterInfo.find((c) => c.clusterId === selectId) || clusterInfo[0],
    [clusterInfo, selectId],
  );

  // 控制Tab切换
  const [activeTabKey, setActiveTabKey] = useState("platformOverview");

  // 找到对应平台概览
  const selectedClusterOverview = useMemo(() => {
    if (activeTabKey === "platformOverview" || !selectItem?.clusterId) {
      return undefined;
    };
    const view = summaryClusterInfo.find(
      (clusterInfo) =>
        clusterInfo.clusterId === activeTabKey,
    );
    return view;
  }, [activeTabKey, summaryClusterInfo, languageId, selectItem]);

  // 当activekey改变时表格数据显示的逻辑
  const filteredClusterInfo = useMemo(() => {
    if (activeTabKey === "platformOverview") {
      setSelectId(undefined);
      return summaryClusterInfo;
    }
    const info = clusterInfo.filter((info) => info.clusterId === activeTabKey);
    return info;
  }, [activeTabKey, clusterInfo, languageId]);

  useEffect(() => {
    if (activeTabKey !== "platformOverview") {
      const selectedInfo = summaryClusterInfo.find((info) => info.clusterId === activeTabKey);
      if (selectedInfo) {
        setSelectId(selectedInfo.clusterId);
      }
    }
  }, [activeTabKey, summaryClusterInfo]);

  const dataSource = (filteredClusterInfo?.map((x, index) =>
    ({
      clusterId: x.clusterId,
      info: {
        ...x,
        id: index,
      },
    })) as TableProps[]);

  const finalDataSource = activeTabKey === "platformOverview" ?
    dataSource.concat(failedClusters.map((c) => ({ clusterId: c.id }))) : dataSource;

  // 平台概览中，无授权分区的集群不展示 0，而是展示 "-"
  const noAuthorizedPartitionClusterIds = useMemo((): Set<string> => {
    return new Set(
      summaryClusterInfo
        .filter((cluster) => cluster.partitions.length === 0)
        .map((cluster) => cluster.clusterId),
    );
  }, [summaryClusterInfo]);

  const shouldRenderDash = (clusterId: string) => {
    return activeTabKey === "platformOverview" && noAuthorizedPartitionClusterIds.has(clusterId);
  };

  const isFullDisplayMode = useContext(DisplayModeContext);

  return (
    (isLoading || currentClusters.length > 0) ? (
      <Container>
        <InfoPanes
          selectItem={activeTabKey === "platformOverview" ? platformOverview : selectedClusterOverview}
          loading={isLoading}
          activeTabKey={activeTabKey}
          onTabChange={setActiveTabKey}
          currentClusters={currentClusters}
        />
        <Table
          style={{
            marginTop:"15px",
          }}
          tableLayout="fixed"
          dataSource={finalDataSource}
          rowKey={(record) => record.info ? `${record.clusterId}-${record.info.id}` : record.clusterId}
          loading={isLoading}
          pagination={false}
          scroll={{ y:275 }}
          rowClassName={(tableProps) => (tableProps.clusterId === selectId ? "rowBgColor" : "")}
          onRow={(r) => {
            return {
              onClick() {
                setSelectId(r.clusterId);
                setActiveTabKey(getI18nConfigCurrentText(r.clusterId, languageId));
              },
            };
          }}
        >
          <Table.Column<TableProps>
            dataIndex="clusterName"
            width={isFullDisplayMode ? "15%" : "minmax(200px, 33.3%)"}
            title={t(p("cluster"))}
            hidden={activeTabKey !== "platformOverview"}
            sorter={(a, b, sortOrder) =>
              compareWithUndefined(a.clusterId, b.clusterId, sortOrder)}
            render={(_, r) => (
              <span>
                {getI18nConfigCurrentText(currentClusters.find((cluster) => cluster.id == r.clusterId)?.name
                ?? r.clusterId, languageId)}
              </span>
            )}
          />
          <Table.Column<TableProps>
            dataIndex="partitionName"
            title={t(p("queue"))}
            hidden={activeTabKey === "platformOverview"}
            sorter={(a, b, sortOrder) => compareWithUndefined(a.info?.partitionName, b.info?.partitionName, sortOrder)}
            render={(_, r) => r.info?.partitionName ?? "-"}
          />
          <Table.Column<TableProps>
            dataIndex="nodeCount"
            title={t(p("nodeCount"))}
            sorter={(a, b, sortOrder) => compareWithUndefined(a.info?.nodeCount, b.info?.nodeCount, sortOrder)}
            render={(_, r) => shouldRenderDash(r.clusterId) ? "-" : (r.info?.nodeCount ?? "-")}
          />
          {
            isFullDisplayMode && (
              <>
                <Table.Column<TableProps>
                  dataIndex="nodeUsage"
                  title={t(p("usageRatePercentage"))}
                  sorter={(a, b, sortOrder) =>
                    compareWithUndefined(a.info?.nodeUsage, b.info?.nodeUsage, sortOrder)}
                  hidden={clusterInfo.every((item) => item.nodeUsage === undefined)}
                  render={(_, r) => (
                    (r.info?.nodeCount && r.info?.nodeUsage !== undefined && !isNaN(r.info.nodeUsage)) ? (
                      <div>
                        <CustomProgress
                          percent={Math.min(Number(Number(r.info?.nodeUsage).toFixed(2) ?? 0), 100)}
                          width="145px"
                          height="20px"
                          bgColor={dark ? "#E3E3E326" : "#43434326"}
                          progressColor="#6897D0"
                        />
                      </div>
                    ) : "-"
                  )}
                />
                <Table.Column<TableProps>
                  dataIndex="cpuUsage"
                  title={t(p("cpuUsage"))}
                  sorter={(a, b, sortOrder) => compareWithUndefined(a.info?.cpuUsage, b.info?.cpuUsage, sortOrder)}
                  render={(_, r) => (
                    (r.info?.cpuCoreCount && r.info?.cpuUsage !== undefined && !isNaN(r.info?.cpuUsage)) ? (
                      <div>
                        <CustomProgress
                          percent={Math.min(Number(Number(r.info?.cpuUsage ?? 0).toFixed(2)), 100)}
                          width="145px"
                          height="20px"
                          bgColor={dark ? "#E3E3E326" : "#43434326"}
                          progressColor="#6897D0"
                        />
                      </div>
                    ) : "-"
                  )}
                />
                <Table.Column<TableProps>
                  dataIndex="gpuUsage"
                  title={t(p("gpuUsage"))}
                  sorter={(a, b, sortOrder) => compareWithUndefined(a.info?.gpuUsage, b.info?.gpuUsage, sortOrder) }
                  render={(_, r) => (
                    (r.info?.gpuCoreCount && r.info?.gpuUsage !== undefined && !isNaN(r.info?.gpuUsage)) ? (
                      <div>
                        <CustomProgress
                          percent={Math.min(Number(Number(r.info.gpuUsage).toFixed(2)), 100)}
                          width="145px"
                          height="20px"
                          bgColor={dark ? "#E3E3E326" : "#43434326"}
                          progressColor="#6897D0"
                        />
                      </div>
                    ) : "-"
                  )}
                />
              </>
            )
          }
          <Table.Column<TableProps>
            dataIndex="pendingJobCount"
            title={t(p("pendingJobCount"))}
            sorter={(a, b, sortOrder) =>
              compareWithUndefined(a.info?.pendingJobCount, b.info?.pendingJobCount, sortOrder)}
            render={(_, r) => shouldRenderDash(r.clusterId) ? "-" : (r.info?.pendingJobCount ?? "-")}
          />
          <Table.Column<TableProps>
            dataIndex="partitionStatus"
            title={t(p("partitionStatus"))}
            hidden={activeTabKey === "platformOverview"}
            sorter={(a, b, sortOrder) =>
              compareWithUndefined(a.info?.partitionStatus, b.info?.partitionStatus, sortOrder)}
            render={(_, r) => r.info?.partitionStatus === 2 ?
              <Tag color="green">{t(p("available"))}</Tag> : <Tag color="red">{t(p("notAvailable"))}</Tag>
            }
          />
        </Table>
      </Container>

    ) : (
      <DashboardSection
        style={{ marginBottom: "16px" }}
        title={t(p("platformOverview"))}
      >
        {t(p("contact"))}
      </DashboardSection>
    )
  );
};
