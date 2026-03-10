"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Cluster } from "@scow/config/build/type";
import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { getCurrentLangTextArgs, getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Divider, Form, Modal, Space, Table, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useState } from "react";
import { usePublicConfig } from "src/app/publicConfigContext";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { FilterFormContainerWithoutBorder } from "src/components/FilterFormContainer";
import { I18nDicType } from "src/models/i18n";
import { AssignmentState, PartitionOperationType } from "src/models/partition";
import { trpc } from "src/server/trpc/api";
import { AssignedClustersPartitionsSchema } from "src/server/trpc/route/partitions/tenantClusterPartitions";

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
  currentClustersData?: Cluster[];
  currentClustersDataFetching: boolean;
  noPartitionClusterNames: string[],
  accountOwnerId?: string;
  accountOwnerName?: string;
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
  currentClustersData,
  currentClustersDataFetching,
  noPartitionClusterNames,
  accountOwnerId,
  accountOwnerName,
}) => {

  const { clusterSortedIdList } = usePublicConfig();

  const [form] = Form.useForm<FormFields>();

  const { message, modal } = App.useApp();

  const [filterForm] = Form.useForm<FilterForm>();
  const initialFilterQuery = {
    cluster: undefined,
    partition: undefined,
  };
  const [query, setQuery] = useState<FilterForm>(initialFilterQuery);

  const displayedTotalPartitionList = useMemo(() => {

    if (!assignedInfo) return;
    const clusterStateMap = new Map(
      assignedInfo.assignedClusters.map((c) => [c.clusterId, c.assignmentState]),
    );
    const clusterSortedIdMap = Object.fromEntries(
      clusterSortedIdList.map((id, index) => [id, index]),
    );

    const filteredData = assignedInfo?.assignedPartitions?.map((item) => {
      return {
        ...item,
        selectable: clusterStateMap.get(item.clusterId) === AssignmentState.ASSIGNED,
      };
    }).sort((a, b) => {
      // 先使用 clusterSortedIdList 的索引进行排序
      const aIndex = clusterSortedIdMap[a.clusterId] ?? Number.MAX_SAFE_INTEGER;
      const bIndex = clusterSortedIdMap[b.clusterId] ?? Number.MAX_SAFE_INTEGER;
      // cluster 索引不同时，按 cluster 顺序排序
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      // cluster 索引相同时，按 partition 名称排序
      return (a.partition ?? "").localeCompare(b.partition ?? "");
    });

    return filteredData;
  }, [assignedInfo,
    currentClustersData,
    clusterSortedIdList,
  ]);

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
      confirmLoading={currentClustersDataFetching}
      footer={null}
      width={800}
    >
      <Form
        form={form}
      >
        {
          operationType === PartitionOperationType.TENANT_OPERATION ? (
            <div style={{ marginBottom: "20px" }}>
              <span>{language.common.tenant}：{assignedTenantName}</span>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "8px" }}>
                <span>{language.common.account}：{assignedAccountName}</span>
              </div>
              <div>
                <span>{language.common.accountOwner}：{`${accountOwnerName}（ID: ${accountOwnerId}）`}</span>
              </div>
            </>
          )
        }
      </Form>
      <FilterFormContainerWithoutBorder style={{ display: "flex", justifyContent: "space-between" }}>
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
          <Button className="ant-form-item" type="primary" htmlType="submit">
            {language.common.search}
          </Button>
        </Form>
      </FilterFormContainerWithoutBorder>

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
      {
        noPartitionClusterNames.length > 0 && filteredPartitionList && filteredPartitionList.length > 0
          && (
            <div style={{ marginBottom: "20px" }}>
              {getCurrentLangTextArgs(
                language.clusterPartitionManagement.common.someClusterPartitionsFailed,
                [noPartitionClusterNames.join(", ")])}
            </div>
          )
      }
      <Table
        tableLayout="fixed"
        dataSource={filteredPartitionList}
        // loading={currentClustersPartitionsFetching}
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
