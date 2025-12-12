"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Cluster } from "@scow/config/build/type";
import { getCurrentLangTextArgs } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Button, Form, Modal, Select, Space } from "antd";
import React, { useEffect, useMemo, useState } from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { I18nDicType } from "src/models/i18n";
import { ClusterPartition } from "src/models/partition";
import { trpc } from "src/server/trpc/api";

interface FormProps {
  cluster: Cluster | undefined,
  partition: string,
}

interface ModalProps {
  tenantName: string;
  defaultPartitions: ClusterPartition[] | undefined,
  defaultClusterIds?: string[],
  currentClusters: Cluster[],
  open: boolean;
  close: () => void;
  refresh: () => void;
  language: I18nDicType;
  languageId?: string;
}

const NewPartitionModal: React.FC<ModalProps> = ({
  tenantName, defaultPartitions, defaultClusterIds, currentClusters, open, close, refresh, language, languageId,
}) => {

  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const { data, refetch, isFetching, error: tenantPartitionsListError }
   = trpc.partitions.tenantAssignedPartitions.useQuery({ tenantName });

  if (tenantPartitionsListError) {
    message.error(language.globalMessage.noPartitionsMessage);
  }

  const cluster = Form.useWatch("cluster", form);

  const [selectablePartitions, setSelectablePartitions] = useState<string[]>([]);

  // 可选分区为 租户已授权分区排除已经添加到默认分区的分区与当前在线集群和已经添加到默认集群的交集
  const selectableClusterPartitionList = useMemo(() => {
    const currentDefaultPartitionsSet
      = new Set(defaultPartitions?.map((item) => `${item.clusterId}-${item.partition}`));

    const currentAvailableClusterIds = defaultClusterIds?.length && defaultClusterIds?.length > 0
      ? currentClusters?.filter((x) => (defaultClusterIds?.includes(x.id)))?.map((x) => (x.id))
      : [];
    const currentClusterIdsSet = new Set(currentAvailableClusterIds);

    const selectableClusterPartitions = data?.assignedPartitions.filter((x) => {
      const isInAssignedPartitions = true;
      const isInCurrentClusterIds = currentClusterIdsSet.has(x.clusterId);
      const isNotInDefaultPartitions = !currentDefaultPartitionsSet.has(`${x.clusterId}-${x.partition}`);
      return isInAssignedPartitions && isInCurrentClusterIds && isNotInDefaultPartitions;
    });

    const clusterPartitionsMap: Record<string, string[]> | undefined
     = selectableClusterPartitions?.reduce((acc, { clusterId, partition }) => {
       if (!acc[clusterId]) {
         acc[clusterId] = [];
       }
       acc[clusterId].push(partition);
       return acc;
     }, {} as Record<string, string[]>);

    return clusterPartitionsMap ?? {};

  }, [defaultPartitions, data, currentClusters]);

  useEffect(() => {
    if (cluster && selectableClusterPartitionList) {
      setSelectablePartitions(selectableClusterPartitionList[cluster?.id]);
    }
  }, [selectableClusterPartitionList, cluster]);

  const addToDefaultPartitionsMutation = trpc.partitions.addToAccountDefaultPartitions.useMutation({
    onSuccess(data) {
      if (data?.failedAssignedAccounts.length > 0) {
        modal.success({
          title: language.accountDefaultPartitions.addModal.successMessage,
          content: getCurrentLangTextArgs(
            language.accountDefaultPartitions.addModal.successExplanation, [data.failedAssignedAccounts.join(", ")]),
        });
      } else {
        message.success(language.accountDefaultPartitions.addModal.successMessage);
      }

      form.resetFields();
      close();
      refresh();
      refetch();
    },
    onError(e) {
      if (e.data?.code === "FORBIDDEN") {
        message.error(language.globalMessage.authFailureMessage);
        return;
      } else if (e.data?.code === "CONFLICT") {
        message.error(e.message);
        return;
      } else {
        message.error(e.message);
      }
    },
  });

  const addToDefaultPartitions = async (
    clusterId: string,
    partition: string,
  ) => {
    await addToDefaultPartitionsMutation.mutateAsync({
      clusterId,
      partition,
      tenantName,
    });
  };

  const onOk = async () => {
    const values = await form.validateFields();
    if (values.cluster && values.partition) await addToDefaultPartitions(values.cluster.id, values.partition);
  };

  return (
    <Modal
      title={language.accountDefaultPartitions.addModal.title}
      open={open}
      onCancel={close}
      onOk={onOk}
      confirmLoading={isFetching || addToDefaultPartitionsMutation.isPending}
    >
      <>
        <p style={{ color: "red" }}>
          {language.accountDefaultPartitions.addModal.addWarn}
        </p>
      </>
      {
        Object.keys(selectableClusterPartitionList).length === 0
        && (
          <Space style={{ marginBottom: "20px" }}>
            {language.accountDefaultPartitions.noDataText}
          </Space>
        )}
      <Form form={form}>
        <Form.Item
          name="cluster"
          rules={[{ required: true }]}
          label={language.common.cluster}
        >
          <SingleClusterSelector
            currentClusters={
              currentClusters?.filter((x) => (Object.keys(selectableClusterPartitionList).includes(x.id)))}
            languageId={languageId}
          />
        </Form.Item>

        <Form.Item
          name="partition"
          rules={[{ required: true }]}
          label={language.common.partition}
          dependencies={["cluster"]}
        >
          <Select placeholder={language.common.partitionSelectorPlaceholder}>
            {selectablePartitions?.map((option) => (
              <Select.Option key={option} value={option}>
                {option}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface Props {
  tenantName?: string,
  defaultPartitions: ClusterPartition[] | undefined,
  defaultClusterIds?: string[],
  currentClusters: Cluster[],
  refresh: () => void;
  language: I18nDicType;
  languageId?: string;
}



export const AddToAccountDefaultPartitionsButton: React.FC<Props> = ({
  tenantName,
  defaultPartitions,
  defaultClusterIds,
  currentClusters,
  refresh,
  language,
  languageId,
}) => {

  const [modalShow, setModalShow] = useState(false);

  return (
    <>
      <NewPartitionModal
        tenantName={tenantName ?? ""}
        defaultPartitions={defaultPartitions}
        defaultClusterIds={defaultClusterIds}
        currentClusters={currentClusters}
        close={() => setModalShow(false)}
        open={modalShow}
        refresh={refresh}
        language={language}
        languageId={languageId}
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalShow(true)}>
        {language.common.add}
      </Button>
    </>
  );
};
