"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Cluster } from "@scow/config/build/type";
import { getCurrentLangTextArgs, getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Divider, Form, Input, Modal, Space, Table, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/publicConfigContext";
import { I18nDicType } from "src/models/i18n";
import { AssignmentState, ClusterPartition, PartitionOperationType } from "src/models/partition";
import { trpc } from "src/server/trpc/api";
import { AssignedClustersPartitionsSchema } from "src/server/trpc/route/partitions/tenantClusterPartitions";

import { SingleClusterSelector } from "../ClusterSelector";
import { FilterFormContainer } from "../FilterFormContainer";

interface Props {
  operationType: PartitionOperationType
  // 要授权的租户名或账户名
  assignedTenantName: string;
  assignedAccountName?: string;
  // 已授权的集群和分区数据
  assignedInfo: AssignedClustersPartitionsSchema | undefined;

  onClose: () => void;
  reload: () => void;
  open: boolean;
  language: I18nDicType;
  languageId: string;
  tenantAssignedPartitions?: ClusterPartition[];
  currentClustersData?: Cluster[];
  currentClustersPartitionsData?: ClusterPartition[];
  currentClustersDataFetching: boolean;
  currentClustersPartitionsFetching: boolean;
}

interface DisplayedPartition {
  clusterId: string;
  partition: string | undefined;
  assignmentState: AssignmentState;
  selectable: boolean;
}

interface FormFields {
  clusterId: string,
  partition: string,
}

interface FilterForm {
  cluster: Cluster | undefined;
  partition: string | undefined;
}

export const PartitionAssignmentModal: React.FC<Props> = ({
  operationType,
  assignedTenantName,
  assignedAccountName,
  assignedInfo,
  onClose,
  reload,
  open,
  language,
  languageId,
  tenantAssignedPartitions,
  currentClustersData,
  currentClustersPartitionsData,
  currentClustersDataFetching,
  currentClustersPartitionsFetching,
}) => {

  const { clusterSortedIdList } = usePublicConfig();

  const [form] = Form.useForm<FormFields>();
  const [partitionsInconsistency, setPartitionDataInconsistency]
   = useState<boolean>(false);

  const { message, modal } = App.useApp();

  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    cluster: undefined,
    partition: undefined,
  };
  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);

  // 租户授权分区展示列表为当前在线集群分区，如果是集群没有授权的分区，对应分区授权按键不可按，增加提示信息
  // 账户授权分区展示列表为租户已授权的分区与在线集群的交集，如果是账户没有被授权的集群的分区，对应分区授权按键不可按，增加提示信息
  const displayedTotalPartitionList = useMemo(() => {

    // 已授权的分区信息
    const assignedDataStr = assignedInfo?.assignedPartitions.map((item) =>
      `${item.clusterId}-${item.partition}`,
    );
    const assignedSet = new Set(assignedDataStr);

    // 已授权的集群Id Set
    const assignedClusterIdsSet = new Set(assignedInfo?.assignedClusters);

    const clusterSortedIdMap = Object.fromEntries(
      clusterSortedIdList.map((id, index) => [id, index]),
    );

    // 如果是租户页面，使用当前在线集群的所有分区
    // 如果是账户页面，使用当前在线集群的所有分区与租户已授权分区的交集
    const clusterPartitionsData = operationType === PartitionOperationType.ACCOUNT_OPERATION ?
      currentClustersPartitionsData?.filter((currentData) => {
        return tenantAssignedPartitions?.some((tenantPartition) => (
          tenantPartition.clusterId === currentData.clusterId &&
        tenantPartition.partition === currentData.partition
        ));
      }) :
      currentClustersPartitionsData;

    const filteredData = clusterPartitionsData?.map((item) => {
      return {
        ...item,
        assignmentState: assignedSet.has(`${item.clusterId}-${item.partition}`) ?
          AssignmentState.ASSIGNED : AssignmentState.UNASSIGNED,
        selectable: assignedClusterIdsSet.has(item.clusterId) ? true : false,
      };
    }).sort((a, b) => {
      // 使用 clusterSortedIdList 的索引进行排序
      const aIndex = clusterSortedIdMap[a.clusterId] ?? Number.MAX_SAFE_INTEGER;
      const bIndex = clusterSortedIdMap[b.clusterId] ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });

    return filteredData;
  }, [assignedInfo,
    currentClustersPartitionsData,
    tenantAssignedPartitions,
    currentClustersData,
    clusterSortedIdList,
  ]);

  // 判断是否存在集群连接获取分区信息失败的情况
  useEffect(() => {

    const currentClusterIds = currentClustersData?.map((x) => x.id);
    let hasInconsistency: boolean = false;
    // 如果是平台管理下的租户授权分区，当前已获取的在线集群下如果分区为空则推测获取数据出现问题
    if (operationType === PartitionOperationType.TENANT_OPERATION &&
      currentClustersPartitionsData &&
      currentClusterIds) {
      hasInconsistency = currentClusterIds.some((id) => {
        return !currentClustersPartitionsData.find((x) => x.clusterId === id);
      });
    }

    // 如果是租户管理下的账户授权分区，当前已获取的在线集群下如果租户已授权的分区数据存在分区为空则推测获取数据出现问题
    if (operationType === PartitionOperationType.ACCOUNT_OPERATION &&
      currentClustersPartitionsData &&
      currentClusterIds &&
      tenantAssignedPartitions) {
      hasInconsistency = tenantAssignedPartitions.some((x) => {
        return currentClusterIds.includes(x.clusterId) &&
        !currentClustersPartitionsData.find((c) => c.clusterId === x.clusterId);
      });
    }

    if (hasInconsistency) {
      setPartitionDataInconsistency(true);
    }
  }, [currentClustersData, currentClustersPartitionsData, tenantAssignedPartitions]);

  const [filteredPartitionList, setFilteredPartitionList] =
    useState<DisplayedPartition[] | undefined>(displayedTotalPartitionList);

  useEffect(() => {
    const { cluster, partition } = query;
    if (displayedTotalPartitionList) {
      const lowerPartition = partition?.toLowerCase();
      const filteredData = displayedTotalPartitionList.filter((x) => {
        const matchCluster = !cluster || x.clusterId === cluster.id;
        const matchPartition = !lowerPartition || x.partition.toLowerCase().includes(lowerPartition);
        return matchCluster && matchPartition;
      });
      setFilteredPartitionList(filteredData);
    }

  }, [query, displayedTotalPartitionList]);

  const assignTenantPartitionMutation = trpc.partitions.assignTenantPartition.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setPartitionAssignmentModal.tenantAssignedSuccessMessage);
      form.resetFields();
      reload();
    },
    onError(e) {
      if (e.data?.code === "FORBIDDEN") {
        message.error(language.globalMessage.authFailureMessage);
        form.resetFields();
        return;
      } else if (e.data?.code === "CONFLICT") {
        message.error(e.message);
        form.resetFields();
        return;
      } else {
        message.error(e.message);
      }
    },
  });

  const unAssignTenantPartitionMutation = trpc.partitions.unAssignTenantPartition.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setPartitionAssignmentModal.tenantUnAssignedMessage);
      form.resetFields();
      reload();
    },
    onError(e) {
      if (e.data?.code === "FORBIDDEN") {
        message.error(language.globalMessage.authFailureMessage);
        form.resetFields();
        return;
      } else if (e.data?.code === "CONFLICT") {
        message.error(e.message);
        form.resetFields();
        return;
      } else {
        message.error(e.message);
      }
    },
  });


  const assignAccountPartitionMutation = trpc.partitions.assignAccountPartition.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setPartitionAssignmentModal.accountAssignedSuccessMessage);
      form.resetFields();
      reload();
    },
    onError(e) {
      if (e.data?.code === "FORBIDDEN") {
        message.error(language.globalMessage.authFailureMessage);
        form.resetFields();
        return;
      } else if (e.data?.code === "CONFLICT") {
        message.error(e.message);
        form.resetFields();
        return;
      } else {
        message.error(e.message);
      }
    },
  });

  const unAssignAccountPartitionMutation = trpc.partitions.unAssignAccountPartition.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setPartitionAssignmentModal.accountUnassignedSuccessMessage);
      form.resetFields();
      reload();
    },
    onError(e) {
      if (e.data?.code === "FORBIDDEN") {
        message.error(language.globalMessage.authFailureMessage);
        form.resetFields();
        return;
      } else if (e.data?.code === "CONFLICT") {
        message.error(e.message);
        form.resetFields();
        return;
      } else {
        message.error(e.message);
      }
    },
  });


  const assignPartition = async (
    clusterId: string,
    partition: string,
  ) => {
    if (operationType === PartitionOperationType.TENANT_OPERATION) {
      await assignTenantPartitionMutation.mutateAsync({
        tenantName: assignedTenantName,
        clusterId,
        partition,
      });
    } else {
      await assignAccountPartitionMutation.mutateAsync({
        accountName: assignedAccountName!,
        tenantName: assignedTenantName,
        clusterId,
        partition,
      });
    }
  };


  const unAssignPartition = async (
    clusterId: string,
    partition: string,
  ) => {
    if (operationType === PartitionOperationType.TENANT_OPERATION) {
      await unAssignTenantPartitionMutation.mutateAsync({
        tenantName: assignedTenantName,
        clusterId,
        partition,
      });
    } else {
      await unAssignAccountPartitionMutation.mutateAsync({
        accountName: assignedAccountName!,
        tenantName: assignedTenantName,
        clusterId,
        partition,
      });
    }
  };

  const closeModal = () => {
    onClose();
    filterForm.resetFields();
    setQuery(initialFilterQuery);
  };

  return (
    <Modal
      title={language.clusterPartitionManagement.common.assignPartition}
      open={open}
      onCancel={closeModal}
      confirmLoading={currentClustersDataFetching || currentClustersPartitionsFetching}
      footer={null}
      width={800}
    >
      <Form
        form={form}
      >
        {
          operationType === PartitionOperationType.TENANT_OPERATION ? (
            <Form.Item label={language.common.tenant}>
              <strong>{assignedTenantName}</strong>
            </Form.Item>
          ) : (
            <Form.Item label={language.common.account}>
              <strong>{assignedAccountName}</strong>
            </Form.Item>
          )
        }
      </Form>
      {
        filteredPartitionList?.length === 0
          && (
            <div style={{ marginBottom: "20px" }}>
              {
                operationType === PartitionOperationType.ACCOUNT_OPERATION ?
                  language.clusterPartitionManagement.common.noAccountDisplayedPartitions :
                  language.clusterPartitionManagement.common.noTenantDisplayedPartitions
              }
            </div>
          )
      }
      {/* 如果有没有获取到的可以展示的集群分区数据，提示集群分区获取可能失败 */}
      {
        partitionsInconsistency && filteredPartitionList && filteredPartitionList.length > 0
          && (
            <div style={{ marginBottom: "20px" }}>
              {language.clusterPartitionManagement.common.someClusterPartitionsFailed}
            </div>
          )
      }
      <FilterFormContainer style={{ display: "flex", justifyContent: "space-between" }}>
        <Form<FilterForm>
          layout="inline"
          form={filterForm}
          initialValues={initialFilterQuery}
          onFinish={async () => {
            const { cluster, partition } = await filterForm.validateFields();
            setQuery({ cluster, partition });
          }}
        >
          <Form.Item label={language.common.cluster} name="cluster">
            <SingleClusterSelector
              languageId={languageId}
              allowClear={true}
              currentClusters={currentClustersData!}
            />
          </Form.Item>
          <Form.Item name="partition">
            <Input allowClear placeholder={language.common.partitionInputPlaceholder} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {language.common.search}
            </Button>
          </Form.Item>
        </Form>
      </FilterFormContainer>

      <Table
        tableLayout="fixed"
        dataSource={filteredPartitionList}
        loading={currentClustersPartitionsFetching}
        pagination={false}
        rowKey={(record) => [record.clusterId, record.partition].join(".")}
        scroll={{ y: 500 }}
      >
        <Table.Column<DisplayedPartition>
          dataIndex="clusterId"
          title={language.common.cluster}
          width="40%"
          render={(_, r) => {
            const clusterName = currentClustersData?.find((cluster) => (cluster.id === r.clusterId))?.name;
            return clusterName ? getI18nConfigCurrentText(clusterName, languageId) : r.clusterId;
          }}
        />
        <Table.Column<DisplayedPartition>
          dataIndex="partition"
          title={language.common.partition}
          width="50%"
          render={(_, r) => {
            return (
              <>
                <Space
                  style={{ width: "150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  title={r.partition}
                >
                  {r.partition}
                </Space>
                <Divider type="vertical" />
                <Tag color={r.assignmentState === AssignmentState.ASSIGNED ? "green" : "red"}>
                  {r.assignmentState === AssignmentState.ASSIGNED ?
                    language.clusterPartitionManagement.common.assignedState :
                    language.clusterPartitionManagement.common.unAssignedState}
                </Tag>
              </>

            );
          }}
        />
        <Table.Column<DisplayedPartition>
          dataIndex="assignmentState"
          title={language.common.operation}
          width="15%"
          fixed="right"
          align="center"
          render={(_, r) => (
            <Space>
              {
                r.assignmentState === AssignmentState.ASSIGNED && (
                  <a onClick={() => {
                    const contentTexts = operationType === PartitionOperationType.TENANT_OPERATION
                      ? getCurrentLangTextArgs(
                        language.clusterPartitionManagement.setPartitionAssignmentModal.unAssignContent, [
                          r.clusterId, r.partition, assignedTenantName,
                        ])
                      : getCurrentLangTextArgs(
                        language.clusterPartitionManagement.setPartitionAssignmentModal.unAssignContent, [
                          r.clusterId, r.partition, assignedAccountName,
                        ]);
                    modal.confirm({
                      title: language.common.unassign,
                      icon: <ExclamationCircleOutlined />,
                      content: (
                        <>
                          <p>
                            {contentTexts}
                          </p>
                          {
                            operationType === PartitionOperationType.TENANT_OPERATION &&
                            (
                              <p style={{ color: "red" }}>
                                {language.clusterPartitionManagement.
                                  setPartitionAssignmentModal.unAssignTenantPartitionExplanation}
                              </p>
                            )
                          }
                        </>
                      ),
                      onOk: async () => {
                        // 对租户/账户取消授权
                        await unAssignPartition(r.clusterId, r.partition!);
                      },
                    });

                  }}
                  >
                    {language.common.unassign}
                  </a>
                )}
              {
                r.assignmentState === AssignmentState.UNASSIGNED && (
                  <Tooltip
                    title={!r.selectable ? language.globalMessage.unassignPartitionWithoutAssignedClusterWarn : ""}
                  >
                    <Button
                      type="link"
                      disabled={!r.selectable}
                      onClick={() => {
                        const operationTarget = operationType === PartitionOperationType.TENANT_OPERATION
                          ? `${language.common.tenant }${assignedTenantName}`
                          : `${language.common.account}${assignedAccountName}`;
                        modal.confirm({
                          title: language.common.assign,
                          icon: <ExclamationCircleOutlined />,
                          content: getCurrentLangTextArgs(
                            language.clusterPartitionManagement.setPartitionAssignmentModal.assignContent,
                            [r.clusterId, r.partition, operationTarget]),
                          onOk: async () => {
                            // 对租户/账户授权;
                            await assignPartition(r.clusterId, r.partition!);
                          },
                        });
                      }}
                    >
                      {language.common.assign}
                    </Button>
                  </Tooltip>
                )}
            </Space>
          )}
        />
      </Table>

    </Modal>

  );
};
