import { useDarkMode } from "@scow/lib-web/build/layouts/darkMode";
import { DisplayModeContext } from "@scow/lib-web/build/layouts/DisplayModeContext";
import { compareWithUndefined } from "@scow/lib-web/build/utils/dashboard";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { PartitionInfo, PartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";
import { Table, Tag } from "antd";
import React, { useContext,useEffect, useMemo, useState } from "react";
import { Localized, prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterOverview, PlatformOverview } from "src/models/cluster";
import { InfoPanes } from "src/pageComponents/dashboard/InfoPanes";
import { Cluster } from "src/utils/cluster";
import { styled } from "styled-components";

import { CustomProgress } from "./CustomProgress";
import { DashboardSection } from "./DashboardSection";

export interface ClusterInfo extends PartitionInfo {
  clusterId: string;
  cpuUsage: string;
  nodeUsage: string;
  gpuUsage?: string;
}

interface Props {
  clusterInfo: ClusterInfo[];
  failedClusters: Cluster[];
  currentClusters: Cluster[];
  isLoading: boolean;
  clustersOverview: ClusterOverview[];
  platformOverview?: PlatformOverview | undefined;
  successfulClusters?: Cluster[] | undefined
}

interface InfoProps {
  id: number;
  partitionName: string;
  nodeCount: number;
  pendingJobCount: number;
  cpuUsage: string;
  nodeUsage: string;
  gpuUsage?: string;
  partitionStatus: PartitionInfo_PartitionStatus;
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

const TableContainer = styled.div`
  .ant-table-wrapper .ant-table-container {
    box-shadow: #0000000D 0px 4px 4px 0px;
  }
`;

const p = prefix("pageComp.dashboard.overviewTable.");

// currentClusters 是过滤用户可用集群后的集合
export const OverviewTable: React.FC<Props> = ({ clusterInfo, failedClusters,
  currentClusters, isLoading, clustersOverview, platformOverview, successfulClusters }) => {
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const { dark } = useDarkMode();

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
    const view = clustersOverview.find(
      (overview) =>
        overview.clusterId === activeTabKey,
    );
    return view;
  }, [activeTabKey, clustersOverview, languageId, selectItem]);

  // 当activekey改变时表格数据显示的逻辑
  const filteredClusterInfo: ClusterOverview[] | ClusterInfo[] = useMemo(() => {
    if (activeTabKey === "platformOverview") {
      setSelectId(undefined);
      return clustersOverview;
    }
    const info = clusterInfo.filter((info) => info.clusterId === activeTabKey);
    return info;
  }, [activeTabKey, clusterInfo, languageId]);

  useEffect(() => {
    if (activeTabKey !== "platformOverview") {
      const selectedInfo = clusterInfo.find((info) => info.clusterId === activeTabKey);
      if (selectedInfo) {
        setSelectId(selectedInfo.clusterId);
      }
    }
  }, [activeTabKey, clusterInfo]);

  const dataSource = (filteredClusterInfo.map((x, index) =>
    ({
      clusterId: x.clusterId,
      info: {
        ...x,
        id: index,
        cpuUsage: ((x.runningCpuCount / x.cpuCoreCount) * 100).toFixed(2),
        nodeUsage: ((x.runningNodeCount / x.nodeCount) * 100).toFixed(2),
        gpuUsage: x.gpuCoreCount === 0 ? undefined : ((x.runningGpuCount / x.gpuCoreCount) * 100).toFixed(2),
      },
    })) as TableProps[]);

  const finalDataSource = activeTabKey === "platformOverview" ?
    dataSource.concat(failedClusters.map((c) => ({ clusterId: c.id }))) : dataSource;

  const isFullDisplayMode = useContext(DisplayModeContext);

  return (
    (isLoading || currentClusters.length > 0) ? (
      <Container>
        <InfoPanes
          selectItem={activeTabKey === "platformOverview" ? platformOverview : selectedClusterOverview}
          loading={isLoading}
          activeTabKey={activeTabKey}
          onTabChange={setActiveTabKey}
          successfulClusters={successfulClusters}
        />
        <TableContainer>
          <Table
            style={{
              marginTop: "15px",
            }}
            tableLayout="fixed"
            dataSource={finalDataSource}
            loading={isLoading}
            pagination={false}
            scroll={{ y: 275 }}
            rowClassName={(tableProps) => (tableProps.info?.id === selectId ? "rowBgColor" : "")}
            onRow={(r) => {
              return {
                onClick() {
                  if (r.info?.id !== undefined) {
                    setSelectId(r.clusterId);
                    setActiveTabKey(getI18nConfigCurrentText(r.clusterId, languageId));
                  }
                },
              };
            }}
          >
            <Table.Column<TableProps>
              dataIndex="clusterName"
              width={isFullDisplayMode ? "15%" : "33.3%"}
              title={t(p("clusterName"))}
              hidden={activeTabKey !== "platformOverview"}
              sorter={(a, b, sortOrder) => compareWithUndefined(a.clusterId, b.clusterId, sortOrder)}
              render={(_, r) => (
                <span>
                  {getI18nConfigCurrentText(currentClusters.find((cluster) => cluster.id == r.clusterId)?.name
                    ?? r.clusterId, languageId)}
                </span>
              )}
            />
            <Table.Column<TableProps>
              dataIndex="partitionName"
              title={t(p("partitionName"))}
              hidden={activeTabKey === "platformOverview"}
              sorter={(a, b, sortOrder) => compareWithUndefined(
                a.info?.partitionName, b.info?.partitionName, sortOrder)}
              render={(_, r) => r.info?.partitionName ?? "-"}
            />
            <Table.Column<TableProps>
              dataIndex="nodeCount"
              title={t(p("nodeCount"))}
              sorter={(a, b, sortOrder) => compareWithUndefined(a.info?.nodeCount, b.info?.nodeCount, sortOrder)}
              render={(_, r) => r.info?.nodeCount ?? "-"}
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
                      (r.info?.nodeUsage !== undefined && !isNaN(parseFloat(r.info.nodeUsage))) ? (
                        <div>
                          <CustomProgress
                            percent={Math.min(Number(Number(r.info?.nodeUsage).toFixed(2)), 100)}
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
                      (r.info?.cpuUsage !== undefined && !isNaN(parseFloat(r.info?.cpuUsage))) ? (
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
                    sorter={(a, b, sortOrder) => compareWithUndefined(a.info?.gpuUsage, b.info?.gpuUsage, sortOrder)}
                    render={(_, r) => (
                      (r.info?.gpuUsage !== undefined && !isNaN(parseFloat(r.info?.gpuUsage))) ? (
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
              render={(_, r) => r.info?.pendingJobCount ?? "-"}
            />
            <Table.Column<TableProps>
              dataIndex="partitionStatus"
              title={t(p("partitionStatus"))}
              hidden={activeTabKey === "platformOverview"}
              sorter={(a, b, sortOrder) =>
                compareWithUndefined(a.info?.partitionStatus, b.info?.partitionStatus, sortOrder)}
              render={(_, r) => r.info?.partitionStatus === 0 ?
                <Tag color="red">{t(p("notAvailable"))}</Tag> : <Tag color="green">{t(p("available"))}</Tag>
              }
            />
          </Table>
        </TableContainer>
      </Container>
    ) : (
      <DashboardSection
        style={{ marginBottom: "16px" }}
        title={<Localized id={"pageComp.dashboard.overviewTable.title"} />}
      >
        {t("pages.common.noAvailableClusters")}
      </DashboardSection>
    )
  );
};
