"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Cluster } from "@scow/config/build/type";
import { App, Button, Form, Modal, Space } from "antd";
import React, { useMemo, useState } from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { I18nDicType } from "src/models/i18n";
import { trpc } from "src/server/trpc/api";



interface FormProps {
  // clusterId: string,
  cluster: Cluster,
}

interface ModalProps {
  tenantName: string;
  // 已授权的账户默认集群
  defaultAssignedClusters: string[] | undefined,
  // 当前在线集群
  currentClusters: Cluster[],
  open: boolean;
  close: () => void;
  refresh: () => void;
  language: I18nDicType;
  languageId?: string;
}

const NewClusterModal: React.FC<ModalProps> = ({
  tenantName, defaultAssignedClusters, currentClusters, open, close, refresh, language, languageId,
}) => {

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const { data, refetch, isFetching, error: tenantClustersListError }
   = trpc.partitions.tenantAssignedClusters.useQuery({ tenantName });
  if (tenantClustersListError) {
    message.error(language.accountDefaultClusters.defaultAccountClustersNotFoundError);
  }

  // 可选集群为 租户已授权集群排除已经添加到默认集群的集群与当前在线集群的交集
  const selectableClustersList = useMemo(() => {
    const currentDefaultClustersSet = new Set(defaultAssignedClusters);
    const currentClusterIdsSet = new Set(currentClusters?.map((x) => (x.id)));
    const selectableClusters = data?.assignedClusters?.filter((x) => (
      (defaultAssignedClusters?.length === 0 || !currentDefaultClustersSet.has(x))
      && currentClusterIdsSet.has(x)
    ));
    return selectableClusters ?? [];
  }, [defaultAssignedClusters, currentClusters, data]);

  const addToDefaultClustersMutation = trpc.partitions.addToAccountDefaultClusters.useMutation({
    onSuccess() {
      message.success(language.accountDefaultClusters.addModal.successMessage);
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


  const addToDefaultClusters = async (
    clusterId: string,
  ) => {
    await addToDefaultClustersMutation.mutateAsync({
      clusterId,
      tenantName,
    });
  };

  const onOk = async () => {
    const { cluster } = await form.validateFields();
    await addToDefaultClusters(cluster.id);
  };

  return (
    <Modal
      title={language.accountDefaultClusters.addModal.title}
      open={open}
      onCancel={close}
      onOk={onOk}
      confirmLoading={isFetching || addToDefaultClustersMutation.isPending}
    >
      <>
        <p style={{ color: "red" }}>
          {language.accountDefaultClusters.addModal.addWarn}
        </p>
      </>
      {
        selectableClustersList.length === 0
        && (
          <Space style={{ marginBottom: "20px" }}>
            {language.accountDefaultClusters.noDataText}
          </Space>
        )}
      <Form form={form}>
        <Form.Item name="cluster" rules={[{ required: true }]} label={language.common.cluster}>
          <SingleClusterSelector
            currentClusters={currentClusters?.filter((x) => (selectableClustersList.includes(x.id)))}
            languageId={languageId}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface Props {
  tenantName: string,
  defaultAssignedClusters: string[] | undefined,
  currentClusters: Cluster[],
  refresh: () => void;
  language: I18nDicType;
  languageId?: string;
}

export const AddToAccountDefaultClustersButton: React.FC<Props> = ({
  tenantName,
  defaultAssignedClusters,
  currentClusters,
  refresh,
  language,
  languageId,
}) => {

  const [modalShow, setModalShow] = useState(false);

  return (
    <>
      <NewClusterModal
        tenantName={tenantName}
        defaultAssignedClusters={defaultAssignedClusters}
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
