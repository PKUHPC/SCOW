import { Table, Tag } from "antd";
import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CustomProgress } from "src/features/dashboard/components/CustomProgress";
import { DashboardSection } from "src/features/dashboard/components/DashboardSection";
import { InfoPanes } from "src/features/dashboard/components/InfoPanes";
import { DisplayModeContext } from "src/features/dashboard/DisplayModeContext";
import type {
  DashboardCluster,
  DashboardClusterSummary,
  DashboardPartitionInfo,
  PlatformOverview,
} from "src/features/dashboard/types";
import { compareWithUndefined, getLocalizedText } from "src/features/dashboard/utils";
import { styled } from "styled-components";

interface ClusterPartitionInfo extends DashboardPartitionInfo {
  clusterId: string;
}

interface Props {
  clusterInfo: ClusterPartitionInfo[];
  failedClusters: DashboardCluster[];
  currentClusters: DashboardCluster[];
  isLoading: boolean;
  summaryClusterInfo: DashboardClusterSummary[];
  platformOverview?: PlatformOverview;
}

interface TableInfo {
  id: number;
  partitionName?: string;
  nodeCount?: number;
  pendingJobCount?: number;
  cpuCoreCount?: number;
  gpuCoreCount?: number;
  cpuUsage?: number;
  nodeUsage?: number;
  gpuUsage?: number;
  partitionStatus?: number;
}

interface TableRow {
  clusterId: string;
  info?: TableInfo;
  failed?: boolean;
}

const Container = styled.div`
  .ant-table-body {
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

  .rowBgColor td {
    background: none !important;
  }
`;

const TableContainer = styled.div`
  .ant-table-wrapper .ant-table-container {
    box-shadow: #0000000d 0px 4px 4px 0px;
  }
`;

export function OverviewTable({
  clusterInfo,
  failedClusters,
  currentClusters,
  isLoading,
  platformOverview,
  summaryClusterInfo,
}: Props) {
  const { i18n, t } = useTranslation("dashboard");
  const [selectId, setSelectId] = useState<string>();
  const [activeTabKey, setActiveTabKey] = useState("platformOverview");
  const isFullDisplayMode = useContext(DisplayModeContext);

  const selectedClusterOverview = useMemo(
    () =>
      activeTabKey === "platformOverview"
        ? undefined
        : summaryClusterInfo.find((cluster) => cluster.clusterId === activeTabKey),
    [activeTabKey, summaryClusterInfo],
  );
  const filteredClusterInfo = useMemo(
    () =>
      activeTabKey === "platformOverview"
        ? summaryClusterInfo
        : clusterInfo.filter((info) => info.clusterId === activeTabKey),
    [activeTabKey, clusterInfo, summaryClusterInfo],
  );

  useEffect(() => {
    if (activeTabKey === "platformOverview") {
      setSelectId(undefined);
    } else {
      setSelectId(activeTabKey);
    }
  }, [activeTabKey]);

  const availableClusters = useMemo(
    () => currentClusters.filter((cluster) => !failedClusters.some(({ id }) => id === cluster.id)),
    [currentClusters, failedClusters],
  );

  useEffect(() => {
    if (activeTabKey !== "platformOverview" && !availableClusters.some((cluster) => cluster.id === activeTabKey)) {
      setActiveTabKey("platformOverview");
    }
  }, [activeTabKey, availableClusters]);

  const dataSource: TableRow[] = filteredClusterInfo.map((info, index) => ({
    clusterId: info.clusterId,
    info: { ...info, id: index },
  }));
  const finalDataSource =
    activeTabKey === "platformOverview"
      ? dataSource.concat(failedClusters.map((cluster) => ({ clusterId: cluster.id, failed: true })))
      : dataSource;

  if (!isLoading && currentClusters.length === 0 && failedClusters.length === 0) {
    return (
      <DashboardSection
        style={{ marginBottom: "16px" }}
        title={t("dashboard.overviewTable.title", "平台概览")}
      >
        {t("dashboard.noAvailableClusters", "当前没有可用集群。请稍后再试或联系管理员。")}
      </DashboardSection>
    );
  }

  return (
    <Container>
      <InfoPanes
        selectItem={activeTabKey === "platformOverview" ? platformOverview : selectedClusterOverview}
        loading={isLoading}
        activeTabKey={activeTabKey}
        onTabChange={setActiveTabKey}
        currentClusters={availableClusters}
        hasFailedClusters={failedClusters.length > 0}
      />
      <TableContainer>
        <Table
          style={{ marginTop: "15px" }}
          tableLayout="fixed"
          dataSource={finalDataSource}
          rowKey={(record) => `${record.clusterId}-${record.info?.id ?? "failed"}`}
          loading={isLoading}
          pagination={false}
          scroll={{ y: 275 }}
          rowClassName={(row) => (row.failed ? "failedRow" : row.clusterId === selectId ? "rowBgColor" : "")}
          onRow={(row) => ({
            onClick: () => {
              if (row.info && !row.failed) {
                setSelectId(row.clusterId);
                setActiveTabKey(row.clusterId);
              }
            },
          })}
        >
          <Table.Column<TableRow>
            dataIndex="clusterName"
            width={isFullDisplayMode ? "15%" : "33.3%"}
            title={t("dashboard.overviewTable.clusterName", "集群")}
            hidden={activeTabKey !== "platformOverview"}
            sorter={(first, second, sortOrder) => compareWithUndefined(first.clusterId, second.clusterId, sortOrder)}
            render={(_, row) => (
              <>
                {getLocalizedText(
                  currentClusters.find((cluster) => cluster.id === row.clusterId)?.name ?? row.clusterId,
                  i18n.language,
                )}
                {row.failed ? (
                  <Tag color="error" style={{ marginLeft: 8 }}>
                    {t("dashboard.overviewTable.fetchFailed", "获取失败")}
                  </Tag>
                ) : null}
              </>
            )}
          />
          <Table.Column<TableRow>
            dataIndex="partitionName"
            title={t("dashboard.overviewTable.partitionName", "分区")}
            hidden={activeTabKey === "platformOverview"}
            sorter={(first, second, sortOrder) =>
              compareWithUndefined(first.info?.partitionName, second.info?.partitionName, sortOrder)
            }
            render={(_, row) => row.info?.partitionName ?? "-"}
          />
          <Table.Column<TableRow>
            dataIndex="nodeCount"
            title={t("dashboard.overviewTable.nodeCount", "节点总数")}
            sorter={(first, second, sortOrder) =>
              compareWithUndefined(first.info?.nodeCount, second.info?.nodeCount, sortOrder)
            }
            render={(_, row) => row.info?.nodeCount ?? "-"}
          />
          {isFullDisplayMode ? (
            <>
              <Table.Column<TableRow>
                dataIndex="nodeUsage"
                title={t("dashboard.overviewTable.usageRatePercentage", "节点使用率")}
                sorter={(first, second, sortOrder) =>
                  compareWithUndefined(first.info?.nodeUsage, second.info?.nodeUsage, sortOrder)
                }
                render={(_, row) =>
                  row.info?.nodeCount && row.info.nodeUsage !== undefined ? (
                    <CustomProgress
                      percent={Math.min(Number(row.info.nodeUsage.toFixed(2)), 100)}
                      width="145px"
                      height="20px"
                      bgColor="#43434326"
                      progressColor="#6897D0"
                    />
                  ) : (
                    "-"
                  )
                }
              />
              <Table.Column<TableRow>
                dataIndex="cpuUsage"
                title={t("dashboard.overviewTable.cpuUsage", "CPU使用率")}
                sorter={(first, second, sortOrder) =>
                  compareWithUndefined(first.info?.cpuUsage, second.info?.cpuUsage, sortOrder)
                }
                render={(_, row) =>
                  row.info?.cpuCoreCount && row.info.cpuUsage !== undefined ? (
                    <CustomProgress
                      percent={Math.min(Number(row.info.cpuUsage.toFixed(2)), 100)}
                      width="145px"
                      height="20px"
                      bgColor="#43434326"
                      progressColor="#6897D0"
                    />
                  ) : (
                    "-"
                  )
                }
              />
              <Table.Column<TableRow>
                dataIndex="gpuUsage"
                title={t("dashboard.overviewTable.gpuUsage", "加速卡使用率")}
                sorter={(first, second, sortOrder) =>
                  compareWithUndefined(first.info?.gpuUsage, second.info?.gpuUsage, sortOrder)
                }
                render={(_, row) =>
                  row.info?.gpuCoreCount && row.info.gpuUsage !== undefined ? (
                    <CustomProgress
                      percent={Math.min(Number(row.info.gpuUsage.toFixed(2)), 100)}
                      width="145px"
                      height="20px"
                      bgColor="#43434326"
                      progressColor="#6897D0"
                    />
                  ) : (
                    "-"
                  )
                }
              />
            </>
          ) : null}
          <Table.Column<TableRow>
            dataIndex="pendingJobCount"
            title={t("dashboard.overviewTable.pendingJobCount", "作业排队数")}
            sorter={(first, second, sortOrder) =>
              compareWithUndefined(first.info?.pendingJobCount, second.info?.pendingJobCount, sortOrder)
            }
            render={(_, row) => row.info?.pendingJobCount ?? "-"}
          />
          <Table.Column<TableRow>
            dataIndex="partitionStatus"
            title={t("dashboard.overviewTable.partitionStatus", "分区状态")}
            hidden={activeTabKey === "platformOverview"}
            sorter={(first, second, sortOrder) =>
              compareWithUndefined(first.info?.partitionStatus, second.info?.partitionStatus, sortOrder)
            }
            render={(_, row) =>
              row.info?.partitionStatus === 2 ? (
                <Tag color="green">{t("dashboard.overviewTable.available", "可用")}</Tag>
              ) : (
                <Tag color="red">{t("dashboard.overviewTable.notAvailable", "不可用")}</Tag>
              )
            }
          />
        </Table>
      </TableContainer>
    </Container>
  );
}
