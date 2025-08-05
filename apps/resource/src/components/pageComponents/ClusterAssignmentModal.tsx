"use client";

import { ExclamationCircleOutlined } from "@ant-design/icons";
import { Cluster } from "@scow/config/build/type";
import { getCurrentLangTextArgs, getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Divider, Form, Modal, Space, Table, Tag, Tooltip } from "antd";
import { useMemo } from "react";
import { usePublicConfig } from "src/app/publicConfigContext";
import { AuthorizeIcon, CancleAuthorizeIcon } from "src/assets/operationIcon";
import { I18nDicType } from "src/models/i18n";
import { AssignmentState, PartitionOperationType } from "src/models/partition";
import { trpc } from "src/server/trpc/api";

interface Props {
  operationType: PartitionOperationType
  assignedTenantName: string;
  assignedAccountName?: string;
  assignedClusters: string[];
  // 租户已授权的集群信息， 仅应用在账户授权集群时
  tenantAssignedClusters?: string[];
  onClose: () => void;
  reload: () => void;
  isCurrentClustersLoading: boolean;
  open: boolean;
  language: I18nDicType;
  languageId: string;
  currentClustersData?: Cluster[];
}

interface DisplayedCluster extends Cluster {
  assignmentState: AssignmentState;
}

interface FormFields {
  clusterId: string,
}

export const ClusterAssignmentModal: React.FC<Props> = ({
  operationType,
  assignedTenantName,
  assignedAccountName,
  assignedClusters,
  tenantAssignedClusters,
  onClose,
  reload,
  isCurrentClustersLoading,
  open,
  language,
  languageId,
  currentClustersData,
}) => {

  const { clusterSortedIdList } = usePublicConfig();
  const [form] = Form.useForm<FormFields>();
  const { message, modal } = App.useApp();

  // 租户授权集群展示列表为当前在线集群
  // 账户授权集群展示列表为租户已授权的集群与在线集群的交集
  const displayedTotalClusterList = useMemo(() => {

    const clusterSortedIdMap = Object.fromEntries(
      clusterSortedIdList.map((id, index) => [id, index]),
    );
    const assignedSet = new Set(assignedClusters);
    const clustersData = operationType === PartitionOperationType.ACCOUNT_OPERATION ?
      currentClustersData?.filter((x) => tenantAssignedClusters?.includes(x.id))
      : (currentClustersData ?? []);
    return (clustersData || []).map((item) => ({

      ...item,
      assignmentState: assignedSet.has(item.id) ?
        AssignmentState.ASSIGNED : AssignmentState.UNASSIGNED,

    })).sort((a, b) => {
      // 使用 clusterSortedIdList 的索引进行排序
      const aIndex = clusterSortedIdMap[a.id] ?? Number.MAX_SAFE_INTEGER;
      const bIndex = clusterSortedIdMap[b.id] ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [assignedClusters, currentClustersData]);

  const assignTenantClusterMutation = trpc.partitions.assignTenantCluster.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setClusterAssignmentModal.tenantAssignedSuccessMessage);
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

  const unAssignTenantClusterMutation = trpc.partitions.unAssignTenantCluster.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setClusterAssignmentModal.tenantUnAssignedMessage);
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


  const assignAccountClusterMutation = trpc.partitions.assignAccountCluster.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setClusterAssignmentModal.accountAssignedSuccessMessage);
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

  const unAssignAccountClusterMutation = trpc.partitions.unAssignAccountCluster.useMutation({
    onSuccess() {
      message.success(language.clusterPartitionManagement.setClusterAssignmentModal.accountUnassignedSuccessMessage);
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


  const assignCluster = async (
    clusterId: string,
  ) => {
    if (operationType === PartitionOperationType.TENANT_OPERATION) {
      await assignTenantClusterMutation.mutateAsync({
        tenantName: assignedTenantName,
        clusterId,
      });
    } else {
      await assignAccountClusterMutation.mutateAsync({
        accountName: assignedAccountName!,
        tenantName: assignedTenantName,
        clusterId,
      });
    }
  };

  const unAssignCluster = async (
    clusterId: string,
  ) => {
    if (operationType === PartitionOperationType.TENANT_OPERATION) {
      await unAssignTenantClusterMutation.mutateAsync({
        tenantName: assignedTenantName,
        clusterId,
      });
    } else {
      await unAssignAccountClusterMutation.mutateAsync({
        accountName: assignedAccountName!,
        tenantName: assignedTenantName,
        clusterId,
      });
    }
  };


  return (
    <Modal
      title={language.clusterPartitionManagement.setClusterAssignmentModal.title}
      open={open}
      confirmLoading={isCurrentClustersLoading}
      onCancel={onClose}
      footer={null}
    >
      <Form
        form={form}
      >
        {
          operationType === PartitionOperationType.TENANT_OPERATION ? (
            <Form.Item label={language.common.tenant}>
              <span>{assignedTenantName}</span>
            </Form.Item>
          ) : (
            <Form.Item label={language.common.account}>
              <span>{assignedAccountName}</span>
            </Form.Item>
          )
        }
      </Form>
      {
        displayedTotalClusterList?.length === 0
          && (
            <div style={{ marginBottom: "20px" }}>
              {
                operationType === PartitionOperationType.ACCOUNT_OPERATION ?
                  language.clusterPartitionManagement.common.noAccountDisplayedClusters :
                  language.clusterPartitionManagement.common.noTenantDisplayedClusters
              }
            </div>
          )
      }
      <Table
        tableLayout="fixed"
        dataSource={displayedTotalClusterList}
        loading={isCurrentClustersLoading}
        pagination={false}
        rowKey="id"
        scroll={{ y: 500 }}
      >
        <Table.Column<DisplayedCluster>
          dataIndex="id"
          title={language.common.cluster}
          width="60%"
          render={(_, r) => {
            const name = currentClustersData?.find((cluster) => (cluster.id === r.id))?.name;
            const clusterName = name ? getI18nConfigCurrentText(name, languageId) : r.id;
            return (
              <>
                <Space
                  style={{ width: "150px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  title={clusterName}
                >
                  {clusterName}
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
        // sorter={(a, b) => a.id.localeCompare(b.id)}
        // sortDirections={["ascend", "descend"]}
        // sortOrder={currentSortInfo.field === "id" ? currentSortInfo.order : null}
        />
        <Table.Column<DisplayedCluster>
          dataIndex="assignmentState"
          title={language.common.operation}
          width="40%"
          align="center"
          fixed="right"
          render={(_, r) => (
            <Space>
              {
                r.assignmentState === AssignmentState.ASSIGNED && (
                  <Tooltip title={language.common.unassign}>
                    <CancleAuthorizeIcon onClick={() => {
                      const contentTexts = operationType === PartitionOperationType.TENANT_OPERATION
                        ? getCurrentLangTextArgs(
                          language.clusterPartitionManagement.setClusterAssignmentModal.unAssignContent,
                          [r.id, assignedTenantName])
                        : getCurrentLangTextArgs(
                          language.clusterPartitionManagement.setClusterAssignmentModal.unAssignContent,
                          [r.id, assignedAccountName]);
                      modal.confirm({
                        title: language.common.unassign,
                        icon: <ExclamationCircleOutlined />,
                        content: (
                          <>
                            <p>
                              {contentTexts}
                            </p>
                            {
                              operationType === PartitionOperationType.TENANT_OPERATION ?
                                (
                                  <p style={{ color: "red" }}>
                                    {language.clusterPartitionManagement.
                                      setClusterAssignmentModal.unAssignTenantClusterExplanation}
                                  </p>
                                ) : (
                                  <p style={{ color: "red" }}>
                                    {language.clusterPartitionManagement.
                                      setClusterAssignmentModal.unAssignAccountClusterExplanation}
                                  </p>
                                )
                            }
                          </>
                        ),
                        onOk: async () => {
                        // 对租户/账户取消授权
                          await unAssignCluster(r.id);
                        },
                      });
                    }}
                    />
                  </Tooltip>
                )}
              {
                r.assignmentState === AssignmentState.UNASSIGNED && (
                  <Tooltip title={language.common.assign}>
                    <AuthorizeIcon onClick={() => {
                      const operationTarget = operationType === PartitionOperationType.TENANT_OPERATION
                        ? `${language.common.tenant}${assignedTenantName}`
                        : `${language.common.account}${assignedAccountName}`;
                      const contentTexts = getCurrentLangTextArgs(
                        language.clusterPartitionManagement.setClusterAssignmentModal.assignContent,
                        [r.id, operationTarget]);
                      modal.confirm({
                        title: language.common.assign,
                        icon: <ExclamationCircleOutlined />,
                        content: contentTexts,
                        onOk: async () => {
                        // 对租户/账户授权;
                          await assignCluster(r.id);
                        },
                      });
                    }}
                    />
                  </Tooltip>
                )}
            </Space>
          )}
        />
      </Table>
    </Modal>
  );
};
