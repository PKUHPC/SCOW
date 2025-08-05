/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { ClusterActivationStatus } from "@scow/config/build/type";
import { formatDateTime } from "@scow/lib-web/build/utils/datetime";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Space, Table, Tag, Tooltip } from "antd";
import React, { useMemo, useState } from "react";
import { useStore } from "simstate";
import { api } from "src/apis";
import { StartUseIcon, StopUseIcon } from "src/assets/operationIcon";
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

export const ClusterManagementTable: React.FC<Props> = ({
  data, isLoading, reload,
}) => {

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

    const filteredValues = data
      .filter((cluster) => query.clusters.some((c) => c.id === cluster.clusterId));

    return filteredValues;

  }, [data, query]);


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
              <Button type="primary" htmlType="submit">{tArgs(pCommon("search"))}</Button>
            </Space>
          </Form.Item>
        </Form>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredData}
        loading={isLoading}
        pagination={false}
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
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalNodeCount"
          title={tArgs(p("table.nodesCount"))}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalCpuCoreCount"
          title={tArgs(p("table.cpusCount"))}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalGpuCount"
          width="10%"
          title={tArgs(p("table.gpusCount"))}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="totalMemMb"
          title={tArgs(p("table.totalMemMb"))}
          width="10%"
          render={(_, r) => {
            return `${r.totalMemMb} MB`;
          }}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="connectionStatus"
          title={tArgs(p("table.clusterState"))}
          render={(_, r) => (
            r.connectionStatus === ClusterConnectionStatus.ERROR ? (
              <Tag color="red">{tArgs(p("table.errorState"))}</Tag>
            ) : (
              r.activationStatus === ClusterActivationStatus.DEACTIVATED ?
                <Tag color="red">{tArgs(p("table.deactivatedState"))}</Tag> :
                <Tag color="green">{tArgs(p("table.normalState"))}</Tag>
            )
          )}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="operatorId"
          title={tArgs(p("table.operator"))}
          width="15%"
          render={(_, r) => {
            return r.operatorId ? `${r.operatorName}（ID: ${r.operatorId}）` : "";
          }}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="updateTime"
          title={tArgs(p("table.lastOperatedTime"))}
          width="15%"
          render={(_, r) => formatDateTime(r.updateTime)}
        />
        <Table.Column<CombinedClusterInfo>
          dataIndex="deactivationComment"
          ellipsis
          title={tArgs(p("table.comment"))}
        />
        <Table.Column<CombinedClusterInfo>
          title={tArgs(p("table.operation"))}
          fixed="right"
          width="10%"
          render={(_, r) => {
            const clusterName
            = getI18nConfigCurrentText(publicConfigClusters[r.clusterId].name, languageId);
            return (
              <>
                {/* TODO: 暂时只对门户系统（HPC）中的集群增加启用和停用功能 */}
                {
                  !r.hpcEnabled && (
                    <>
                      --
                    </>
                  )
                }
                {
                  r.hpcEnabled && r.activationStatus === ClusterActivationStatus.DEACTIVATED
                  && (
                    <Space>
                      <Tooltip title={tArgs(p("table.activate"))}>
                        <StartUseIcon
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
                                    ])},
                                  </p>
                                  <p style={{ color: "red" }}>{tArgs(p("activateModal.contentAttention"))}</p>
                                </>
                              ),
                              onOk: async () => {
                                await api.activateCluster({
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
                        />
                      </Tooltip>
                    </Space>
                  )
                }
                { r.hpcEnabled && r.activationStatus === ClusterActivationStatus.ACTIVATED && (
                  <>
                    <DeactivateClusterModalLink
                      clusterId={r.clusterId}
                      clusterName={clusterName}
                      onComplete={async (confirmedClusterId, deactivationComment) => {

                        return await api.deactivateCluster({ body:{
                          clusterId: confirmedClusterId,
                          deactivationComment,
                        } }).then((res) => {
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
                      <Tooltip title={tArgs(p("table.deactivate"))}>
                        <StopUseIcon />
                      </Tooltip>
                    </DeactivateClusterModalLink>
                  </>
                )
                }
              </>
            ); }}
        />
      </Table>
    </div>
  );
};
