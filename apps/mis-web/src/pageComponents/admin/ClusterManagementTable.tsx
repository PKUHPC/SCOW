import { ExclamationCircleOutlined } from "@ant-design/icons";
import { ClusterActivationStatus } from "@scow/config/build/type";
import { compareNullableNumber, compareNullableString } from "@scow/lib-web/build/utils/compareNullableValue";
import { compareDateTime, formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { DEFAULT_PAGE_SIZE } from "@scow/lib-web/build/utils/pagination";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Space, Table, Tag } from "antd";
import React, { useMemo, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { ClusterSelector } from "src/components/ClusterSelector";
import { DeactivateClusterModalLink } from "src/components/DeactivateClusterModal";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { prefix, useI18n, useI18nTranslate } from "src/i18n";
import { ClusterConnectionStatus } from "src/models/cluster";
import { CombinedClusterInfo } from "src/pages/admin/resource/clusterManagement";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster, getSortedClusterValues } from "src/utils/cluster";

interface Props {
  data?: CombinedClusterInfo[];
  isLoading: boolean;
  reload: () => void;
}

interface FilterForm {
  clusters: Cluster[];
}

const p = prefix("page.admin.resourceManagement.clusterManagement.");
const pCommon = prefix("common.");

export const ClusterManagementTable: React.FC<Props> = ({ data, isLoading, reload }) => {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FilterForm>();

  const tArgs = useI18nTranslate();
  const languageId = useI18n().currentLanguage.id;

  const { publicConfigClusters, clusterSortedIdList } = useStore(ClusterInfoStore);

  const [query, setQuery] = useState<FilterForm>(() => {
    return {
      clusters: getSortedClusterValues(publicConfigClusters, clusterSortedIdList),
    };
  });

  const filteredData = useMemo(() => {
    if (!data) return undefined;

    if (!query.clusters || query.clusters.length === 0) {
      return data;
    }

    const filteredValues = data.filter((cluster) => query.clusters.some((c) => c.id === cluster.clusterId));

    return filteredValues;
  }, [data, query]);

  const getStatusWeight = (r: CombinedClusterInfo): number => {
    // 连接错误
    if (r.connectionStatus === ClusterConnectionStatus.ERROR) {
      return 0;
    }
    // 已停用
    if (r.activationStatus === ClusterActivationStatus.DEACTIVATED) {
      return 1;
    }
    // 正常
    return 2;
  };

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={async () => {
            setQuery(await form.validateFields());
          }}
        >
          <Form.Item label={tArgs(p("clusterFilter"))} name="clusters" style={{ minWidth: "200px" }}>
            <ClusterSelector isUsingAllConfigClusters={true} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {tArgs(pCommon("search"))}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={isLoading}
        pagination={{
          showSizeChanger: true,
          defaultPageSize: DEFAULT_PAGE_SIZE,
        }}
        rowKey="clusterId"
        scroll={{ x: true }}
      >
        <Table.Column<CombinedClusterInfo>
          dataIndex="clusterId"
          width="10%"
          title={tArgs(p("table.clusterName"))}
          render={(_, r) => {
            const clusterName = publicConfigClusters[r.clusterId].name;
            return getI18nConfigCurrentText(clusterName ?? r.clusterId, languageId);
          }}
          sorter={(a, b) => {
            const clusterA = getI18nConfigCurrentText(
              publicConfigClusters[a.clusterId].name ?? a.clusterId,
              languageId,
            );
            const clusterB = getI18nConfigCurrentText(
              publicConfigClusters[b.clusterId].name ?? b.clusterId,
              languageId,
            );
            return compareNullableString(clusterA, clusterB);
          }}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalNodeCount"
          title={tArgs(p("table.nodesCount"))}
          sorter={(a, b) => compareNullableNumber(a.totalNodeCount, b.totalNodeCount)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalCpuCoreCount"
          title={tArgs(p("table.cpusCount"))}
          sorter={(a, b) => compareNullableNumber(a.totalCpuCoreCount, b.totalCpuCoreCount)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalGpuCount"
          width="8%"
          title={tArgs(p("table.gpusCount"))}
          sorter={(a, b) => compareNullableNumber(a.totalGpuCount, b.totalGpuCount)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalMemMb"
          title={tArgs(p("table.totalMemGb"))}
          width="12%"
          render={(_, r) => {
            // 显示GB， 保留两位小数
            const totalGb = (r.totalMemMb / 1024).toFixed(2);
            return `${totalGb}`;
          }}
          sorter={(a, b) => compareNullableNumber(a.totalMemMb, b.totalMemMb)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="connectionStatus"
          title={tArgs(p("table.clusterState"))}
          render={(_, r) =>
            r.connectionStatus === ClusterConnectionStatus.ERROR ? (
              <Tag color="red">{tArgs(p("table.errorState"))}</Tag>
            ) : r.activationStatus === ClusterActivationStatus.DEACTIVATED ? (
              <Tag color="red">{tArgs(p("table.deactivatedState"))}</Tag>
            ) : (
              <Tag color="green">{tArgs(p("table.normalState"))}</Tag>
            )
          }
          sorter={(a, b) => compareNullableNumber(getStatusWeight(a), getStatusWeight(b))}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="operatorId"
          title={tArgs(p("table.operator"))}
          width="15%"
          render={(_, r) => {
            return r.operatorId ? `${r.operatorName}（ID: ${r.operatorId}）` : "";
          }}
          sorter={(a, b) => compareNullableString(a.operatorId, b.operatorId)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="updateTime"
          title={tArgs(p("table.lastOperatedTime"))}
          width="15%"
          render={(_, r) => formatDateTime(r.updateTime)}
          sorter={(a, b) => compareDateTime(a.updateTime, b.updateTime)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="deactivationComment"
          ellipsis
          title={tArgs(p("table.comment"))}
          sorter={(a, b) => compareNullableString(a.deactivationComment, b.deactivationComment)}
        />
        <Table.Column<CombinedClusterInfo>
          title={tArgs(p("table.operation"))}
          fixed="right"
          width="10%"
          render={(_, r) => {
            const clusterName = getI18nConfigCurrentText(publicConfigClusters[r.clusterId].name, languageId);
            return (
              <>
                {r.activationStatus === ClusterActivationStatus.DEACTIVATED && (
                  <>
                    <a
                      onClick={() => {
                        modal.confirm({
                          title: tArgs(p("activateModal.title")),
                          icon: <ExclamationCircleOutlined />,
                          content: (
                            <>
                              <p>
                                {tArgs(p("activateModal.content"), [
                                  <strong key="clusterId">{r.clusterId}</strong>,
                                  <strong key="clusterName">{clusterName}</strong>,
                                ])}
                              </p>
                              <p style={{ color: "red" }}>{tArgs(p("activateModal.contentAttention"))}</p>
                            </>
                          ),
                          onOk: async () => {
                            await api
                              .activateCluster({
                                body: {
                                  clusterId: r.clusterId,
                                },
                              })
                              .then((res) => {
                                if (res.executed) {
                                  message.success(tArgs(p("activateModal.successMessage")));
                                  reload();
                                } else {
                                  message.error(res.reason || tArgs(p("activateModal.failureMessage")));
                                  reload();
                                }
                              });
                          },
                        });
                      }}
                    >
                      {tArgs(p("table.activate"))}
                    </a>
                  </>
                )}
                {r.activationStatus === ClusterActivationStatus.ACTIVATED && (
                  <>
                    <DeactivateClusterModalLink
                      clusterId={r.clusterId}
                      clusterName={clusterName}
                      onComplete={async (confirmedClusterId, deactivationComment) => {
                        return await api
                          .deactivateCluster({
                            body: {
                              clusterId: confirmedClusterId,
                              deactivationComment,
                            },
                          })
                          .then((res) => {
                            if (res.executed) {
                              message.success(tArgs(p("deactivateModal.successMessage")));
                              reload();
                            } else {
                              message.error(tArgs(p("deactivateModal.failureMessage")));
                              reload();
                            }
                          });
                      }}
                    >
                      {tArgs(p("table.deactivate"))}
                    </DeactivateClusterModalLink>
                  </>
                )}
              </>
            );
          }}
        />
      </Table>
    </div>
  );
};
