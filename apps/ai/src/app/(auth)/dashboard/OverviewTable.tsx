import { blue,gray } from "@ant-design/colors";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { PartitionInfo, PartitionInfo_PartitionStatus } from "@scow/protos/build/portal/config";
import { Table, Tag } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { ClusterOverview, PlatformOverview } from "src/models/Cluster";
import { Cluster } from "src/utils/cluster";
import { compareWithUndefined } from "src/utils/dashboard";
import { styled } from "styled-components";

import { CustomProgress } from "./CustomProgress";
import { DashboardSection } from "./DashboardSection";
import { InfoPanes } from "./InfoPanes";

export interface ClusterInfo extends PartitionInfo {
  clusterId: string;
  cpuUsage: string;
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
  gpuUsage?: string;
  usageRatePercentage: number;
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
    font-weight: 600;
  }

  .rowBgColor{
    /* 去除鼠标经过默认的背景颜色 */
    td {
      background: none !important;
    }
  }
`;

export const OverviewTable: React.FC<Props> = ({ clusterInfo, failedClusters,
  currentClusters, isLoading, clustersOverview, platformOverview, successfulClusters }) => {

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
    const view = clustersOverview.find(
      (overview) =>
        overview.clusterId === activeTabKey,
    );
    return view;
  }, [activeTabKey, clustersOverview, languageId, selectItem]);

  // 当activekey改变时表格数据显示的逻辑
  const filteredClusterInfo = useMemo(() => {
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
        gpuUsage: x.gpuCoreCount === 0 ? undefined : ((x.runningGpuCount / x.gpuCoreCount) * 100).toFixed(2),
      },
    })) as TableProps[]);

  const finalDataSource = activeTabKey === "platformOverview" ?
    dataSource.concat(failedClusters.map((c) => ({ clusterId: c.id }))) : dataSource;

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
        <Table
          style={{
            marginTop:"15px",
          }}
          tableLayout="fixed"
          dataSource={finalDataSource}
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
            width="15%"
            title={t(p("cluster"))}
            hidden={activeTabKey !== "platformOverview"}
            sorter={(a, b, sortOrder) =>
              compareWithUndefined(a.clusterId, b.clusterId, sortOrder)}
            render={(_, r) => (
              <span style={{ fontWeight:700 }}>
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
            render={(_, r) => r.info?.nodeCount ?? "-"}
          />
          <Table.Column<TableProps>
            dataIndex="usageRatePercentage"
            title={t(p("usageRatePercentage"))}
            sorter={(a, b, sortOrder) =>
              compareWithUndefined(a.info?.usageRatePercentage, b.info?.usageRatePercentage, sortOrder)}
            hidden={clusterInfo.every((item) => item.usageRatePercentage === undefined)}
            render={(_, r) => (
              (r.info?.usageRatePercentage !== undefined && !isNaN(r.info.usageRatePercentage)) ? (
                <div>
                  <CustomProgress
                    percent={Math.min(Number(r.info?.usageRatePercentage.toFixed(2) ?? 0), 100)}
                    width="120px"
                    height="15px"
                    bgColor={gray[0]}
                    progressColor={blue[5]}
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
                    width="120px"
                    height="15px"
                    bgColor={gray[0]}
                    progressColor={blue[5]}
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
              (r.info?.gpuUsage !== undefined && !isNaN(parseFloat(r.info?.gpuUsage))) ? (
                <div>
                  <CustomProgress
                    percent={Math.min(Number(Number(r.info.gpuUsage).toFixed(2)), 100)}
                    width="120px"
                    height="15px"
                    bgColor={gray[0]}
                    progressColor={blue[5]}
                  />
                </div>
              ) : "-"
            )}
          />
          <Table.Column<TableProps>
            dataIndex="pendingJobCount"
            title={t(p("pendingJobCount"))}
            sorter={(a, b, sortOrder) =>
              compareWithUndefined(a.info?.pendingJobCount, b.info?.pendingJobCount, sortOrder)}
            render={(_, r) => r.info?.pendingJobCount ?? "-" }
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
