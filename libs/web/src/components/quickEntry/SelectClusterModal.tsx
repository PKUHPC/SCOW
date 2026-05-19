import { I18nStringType } from "@scow/config/build/i18n";
import { Form, Modal, Select } from "antd";
import React, { useState } from "react";
import { Cluster } from "src/utils/cluster";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";
import { getI18nConfigCurrentText } from "src/utils/systemLanguage";

import { Entry } from ".";
import { EntryCase, IncompleteEntryInfo } from "./AddEntryModal";

export interface Props {
  open: boolean;
  onClose: () => void;
  needLoginNode: boolean;
  clusters: Cluster[];
  addItem: (item: Entry) => void;
  incompleteEntryInfo: IncompleteEntryInfo | null;
  closeAddEntryModal: () => void;
  languageId: string;
  loginNodes?: Record<string, { name: I18nStringType; address: string }[]>;
}

interface FormInfo {
  cluster: string;
  loginNode?: string;
}

export const SelectClusterModal: React.FC<Props> = ({
  open,
  onClose,
  needLoginNode,
  clusters,
  addItem,
  incompleteEntryInfo,
  closeAddEntryModal,
  languageId,
  loginNodes,
}) => {
  const [form] = Form.useForm<FormInfo>();

  const clustersOptions = clusters.map((x) => ({ value: x.id, label: getI18nConfigCurrentText(x.name, languageId) }));
  const [loginNodesOptions, setLoginNodesOptions] = useState<{}[]>([]);

  const handelClusterChange = (cluster: string) => {
    let nodes;
    if (Array.isArray(loginNodes) && typeof loginNodes[0] === "string") {
      nodes = loginNodes.map((x) => ({ value: x, label: x }));
    } else {
      nodes = loginNodes?.[cluster]?.map((x) => ({ value: x.address, label: x.name })) || [];
    }
    setLoginNodesOptions(nodes);
    form.resetFields(["loginNode"]);
  };

  const onFinish = async () => {
    const { cluster, loginNode } = await form.validateFields();

    if (incompleteEntryInfo && incompleteEntryInfo.case === EntryCase.shell) {
      addItem({
        id: incompleteEntryInfo.id,
        name: incompleteEntryInfo.name,
        entry: {
          $case: "shell",
          shell: {
            clusterId: cluster,
            loginNode: loginNode!,
            icon: "MacCommandOutlined",
          },
        },
      });
    } else if (incompleteEntryInfo && incompleteEntryInfo.case === EntryCase.app) {
      addItem({
        id: incompleteEntryInfo.id,
        name: incompleteEntryInfo.name,
        entry: {
          $case: "app",
          app: {
            appId: incompleteEntryInfo.id,
            clusterId: cluster,
          },
        },
      });
    } else if (incompleteEntryInfo && incompleteEntryInfo.case === EntryCase.clusterPageLink) {
      addItem({
        id: incompleteEntryInfo.id,
        name: incompleteEntryInfo.name,
        entry: {
          $case: "clusterPageLink",
          clusterPageLink: {
            clusterId: cluster,
            path: incompleteEntryInfo.path || "",
            icon: incompleteEntryInfo.icon || "",
          },
        },
      });
    }
    form.resetFields();
    onClose();
    closeAddEntryModal();
  };
  return (
    <Modal
      title={getCurrentLangLibWebText(languageId, "selectCluster")}
      open={open}
      onOk={onFinish}
      width={400}
      centered
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} wrapperCol={{ span: 18 }} labelCol={{ span: 6, style: { textAlign: "left" } }}>
        <Form.Item rules={[{ required: true }]} label={getCurrentLangLibWebText(languageId, "cluster")} name="cluster">
          <Select onChange={handelClusterChange} options={clustersOptions} />
        </Form.Item>
        {needLoginNode ? (
          <Form.Item
            rules={[{ required: true }]}
            label={getCurrentLangLibWebText(languageId, "loginNode")}
            name="loginNode"
          >
            <Select options={loginNodesOptions} />
          </Form.Item>
        ) : undefined}
      </Form>
    </Modal>
  );
};
