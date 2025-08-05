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


import { QuestionCircleOutlined } from "@ant-design/icons";
import { debounce } from "@scow/lib-web/build/utils/debounce";
import { useRefreshToken } from "@scow/lib-web/build/utils/refreshToken";
import { App, Button, Divider,Form, Input, Space, Table, Tooltip } from "antd";
import { Popover,Tag } from "antd";
import { useCallback } from "react";
import React, { useState } from "react";
import { useAsync } from "react-async";
import { useStore } from "simstate";
import { api } from "src/apis";
import { NodeMigrationIcon, NodeOnlineIcon } from "src/assets/operationIcon";
import { DisabledA } from "src/components/DisabledA";
import { ClusterNotAvailablePage } from "src/components/errorPages/ClusterNotAvailablePage";
import { FilterFormContainer } from "src/components/FilterFormContainer";
import { MigrateSingleClusterSelector } from "src/components/MigrateClusterSelector";
import { MigrateNodeModalLink } from "src/components/MigrateNodeModal";
import { UploadNodeModalLink } from "src/components/UploadNodeModal";
import { prefix, useI18nTranslate, useI18nTranslateToString } from "src/i18n";
import { getDisplayedNodeStatusI18nTexts,MigrateNodeInfo, NodeStatus } from "src/models/cluster";
import { ClusterInfoStore } from "src/stores/ClusterInfoStore";
import { Cluster } from "src/utils/cluster";

interface FilterForm {
  cluster: Cluster;
  nodeNames?: string;
}

const p = prefix("page.admin.resourceManagement.nodeMigrationPage.");
const pTable = prefix("page.admin.resourceManagement.nodeMigrationPage.table.");
const pModal = prefix("page.admin.resourceManagement.nodeMigrationModal.");
const pCommon = prefix("common.");


export const NodeMigrationTable: React.FC = () => {

  const [form] = Form.useForm<FilterForm>();

  const { message } = App.useApp();

  const tArgs = useI18nTranslate();
  const t = useI18nTranslateToString();

  const DisplayedStatusI18nTexts = getDisplayedNodeStatusI18nTexts(t);

  const { activatedClusters, defaultCluster } = useStore(ClusterInfoStore);

  if (!defaultCluster && Object.keys(activatedClusters).length === 0) {
    return <ClusterNotAvailablePage />;
  }


  const [query, setQuery] = useState<{
    cluster: Cluster;
    nodeNames: string[];
  }>(() => ({
    nodeNames: [],
    cluster: defaultCluster ?? Object.values(activatedClusters)[0],
  }));

  // 前端分页
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  const getPaginatedData = () => {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return data?.slice(start, end) || [];
  };

  const handlePageChange = debounce((page, pageSize) => {
    setPagination({ current: page, pageSize });
  });

  const promiseFn = useCallback(async () => {

    const migrateNodesInfo = await api.getClusterMigrateNodesInfo({
      query: {
        cluster: query.cluster.id,
        nodeNames: query.nodeNames || [],
      },
    }).httpError(409, (e) => {
      message.error({
        content: e.message,
        duration: 4,
      });
    }).httpError(500, (e) => {
      message.error({
        content: e.message,
        duration: 4,
      });
    });

    return migrateNodesInfo?.nodes ?? [];
  }, [query]);

  const [refreshToken] = useRefreshToken();

  const { data, isLoading, reload } = useAsync({ promiseFn, watch: refreshToken });

  const handleSearch = async () => {
    const { cluster, nodeNames } = await form.validateFields();
    let trimmedNodeNames: string[];
    if (Array.isArray(nodeNames) && nodeNames.length === 0) {
      trimmedNodeNames = [];
    } else {
      trimmedNodeNames = nodeNames ? [nodeNames.trim()] : [];
    }
    setQuery({
      cluster,
      nodeNames: trimmedNodeNames,
    });
  };

  const handleError = (e: any, destroyKey: string) => {
    message.destroy(destroyKey);
    message.error({
      content: e.message,
      duration: 4,
    });
  };

  return (
    <div>
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={form}
          initialValues={query}
          onFinish={handleSearch}
        >
          <Form.Item label={tArgs(p("clusterFilter"))} name="cluster" style={{ minWidth: "200px" }}>
            <MigrateSingleClusterSelector />
          </Form.Item>
          <Form.Item
            label={tArgs(p("nodeFilter"))}
            name="nodeNames"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();

                  const isValidFormat = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)?$/.test(value);
                  // slurm允许大写，但是为了兼容k8s暂不支持大写字母

                  if (!isValidFormat) {
                    return Promise.reject(new Error(t(pTable("nodeNamePrompt"))));
                  }

                  return Promise.resolve(); // 验证通过时需主动 resolve
                },
              },
            ]}
          >
            <Input />
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
        dataSource={getPaginatedData()} // 使用分页后的数据
        loading={isLoading}
        pagination={{
          ...pagination,
          total: data?.length || 0, // 总数据量
          showSizeChanger: true,
          onChange: (page, pageSize) => {
            handlePageChange(page, pageSize);
          },
        }}
        rowKey="clusterId"
      >
        <Table.Column<MigrateNodeInfo>
          dataIndex="nodeName"
          title={tArgs(pTable("node"))}
        />
        <Table.Column<MigrateNodeInfo>
          dataIndex="partitions"
          title={tArgs(pTable("partition"))}
          render={(_, r) => r.partitions.map((item) => item).join(", ")}
        />
        <Table.Column<MigrateNodeInfo>
          dataIndex="nodeStatus"
          title={(
            <Space>
              {tArgs(pTable("status"))}
              <Popover
                title={tArgs(pTable("statusTooltip"))}
                content={(
                  <>
                    <span>{tArgs(pTable("statusIdleTooltip"))}</span>
                    <br />
                    <span>{tArgs(pTable("statusRunningTooltip"))}</span>
                    <br />
                    <span>{tArgs(pTable("statusOfflineTooltip"))}</span>
                  </>
                )}
              >
                <QuestionCircleOutlined />
              </Popover>
            </Space>
          )}
          render={(_, r) => (
            <Tag color={ r.nodeStatus === NodeStatus.OCCUPIED_BY_JOBS ? "orange"
              : r.nodeStatus === NodeStatus.OFFLINE_RECOVERABLE ? "red"
                : "green"}
            >
              {DisplayedStatusI18nTexts[r.nodeStatus]}
            </Tag>
          )}
        />
        <Table.Column<MigrateNodeInfo>
          title={tArgs(pTable("operation"))}
          fixed="right"
          render={(_, r) => {
            const { cluster, nodeName, nodeStatus, partitions, migratableClusterList } = r;
            return (
              <Space split={<Divider type="vertical" />}>
                {
                  nodeStatus === NodeStatus.ACTIVE_MIGRATABLE ?
                    (
                      <MigrateNodeModalLink
                        nodeName={nodeName}
                        clusterId={cluster}
                        partitions={partitions}
                        migratableClusterList={migratableClusterList}
                        onComplete={async (destinationCluster) => {

                          message.open({
                            type: "loading",
                            content: tArgs("common.waitingMessage"),
                            duration: 0,
                            key: "migrateNode" });

                          return await api.migrateNode({ body:{
                            nodeName,
                            originCluster: cluster,
                            destinationCluster,
                          } }).httpError(409, (e) => handleError(e, "migrateNode"))
                            .httpError(500, (e) => handleError(e, "migrateNode"))
                            .httpError(501, (e) => handleError(e, "migrateNode"))
                            .then(() => {
                              message.destroy("migrateNode");
                              message.success(tArgs(pModal("successMessage")));
                              reload();
                            }).catch(() => {
                              message.destroy("migrateNode");
                              message.error(tArgs(pModal("migrateFail")));
                              reload();
                            }); ;

                        }}
                      >
                        <Tooltip title={tArgs(pTable("migrate"))}>
                          <NodeMigrationIcon />
                        </Tooltip>
                      </MigrateNodeModalLink>
                    ) : (
                      <DisabledA message={tArgs(pTable("unmetMigrationCondition"))} disabled={true}>
                        <NodeMigrationIcon disabled />
                      </DisabledA>
                    )
                }
                {
                  nodeStatus === NodeStatus.OFFLINE_RECOVERABLE ? (
                    <UploadNodeModalLink
                      nodeName={nodeName}
                      clusterId={cluster}
                      partitions={partitions}
                      onComplete={async () => {

                        message.open({
                          type: "loading",
                          content: tArgs("common.waitingMessage"),
                          duration: 0,
                          key: "activateNode" });

                        return await api.activateNode({ body:{
                          nodeName,
                          destinationCluster: cluster,
                        } }).httpError(409, (e) => handleError(e, "activateNode"))
                          .httpError(500, (e) => handleError(e, "activateNode"))
                          .httpError(501, (e) => handleError(e, "activateNode"))
                          .then(() => {
                            message.destroy("activateNode");
                            message.success(tArgs(pModal("successMessage2")));
                            reload();
                          }).catch(() => {
                            message.destroy("activateNode");
                            message.error(tArgs(pModal("activateNodeFail")));

                            reload();
                          }); ;

                      }}
                    >
                      <Tooltip title={tArgs(pTable("activate"))}>
                        <NodeOnlineIcon />
                      </Tooltip>
                    </UploadNodeModalLink>
                  ) : (
                    <DisabledA message={tArgs(pTable("unmetOnlineCondition"))} disabled={true}>
                      <NodeOnlineIcon disabled />
                    </DisabledA>
                  )
                }
              </Space>
            );
          }}
        />
      </Table>
    </div>
  );
};
