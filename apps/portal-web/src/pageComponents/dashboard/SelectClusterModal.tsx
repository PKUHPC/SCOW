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

import { Entry } from "@scow/protos/build/portal/dashboard";
import { Form, Modal, Select } from "antd";
import React, { useState } from "react";
import { useStore } from "simstate";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { LoginNodeStore } from "src/stores/LoginNodeStore";
import { Cluster } from "src/utils/config";

import { EntryCase, IncompleteEntryInfo } from "./AddEntryModal";

export interface Props {
  open: boolean;
  onClose: () => void;
  needLoginNode: boolean;
  clusters: Cluster[];
  addItem: (item: Entry) => void;
  IncompleteEntryInfo: IncompleteEntryInfo | null;
  closeAddEntryModal: () => void;
}

interface FormInfo {
  cluster: string;
  loginNode?: string;
}
const p = prefix("pageComp.dashboard.changeClusterModal.");

export const SelectClusterModal: React.FC<Props> = ({
  open,
  onClose,
  needLoginNode,
  clusters,
  addItem,
  IncompleteEntryInfo,
  closeAddEntryModal,
}) => {
  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormInfo>();

  const clustersOptions = clusters.map((x) => ({ value:x.id, label:x.name }));
  const { loginNodes } = useStore(LoginNodeStore);
  const [loginNodesOptions, setLoginNodesOptions] = useState<{}[]>([]);

  const handelClusterChange = (cluster: string) => {
    const nodes = loginNodes[cluster].map((x) => ({ value:x.address, label:x.name }));
    setLoginNodesOptions(nodes);
    form.resetFields(["loginNode"]);
  };

  const onFinish = async () => {
    const { cluster, loginNode } = await form.validateFields();
    if (IncompleteEntryInfo && IncompleteEntryInfo.case === EntryCase.shell) {
      addItem({
        id:IncompleteEntryInfo.id,
        name:IncompleteEntryInfo.name,
        entry:{
          $case:"shell",
          shell:{
            clusterId:cluster,
            loginNode:loginNode as string,
            icon:"MacCommandOutlined",
          },
        } });
    }
    else if (IncompleteEntryInfo && IncompleteEntryInfo.case === EntryCase.app) {
      addItem({
        id:IncompleteEntryInfo.id,
        name:IncompleteEntryInfo.name,
        entry:{
          $case:"app",
          app:{
            clusterId:cluster,
          },
        } });
    }
    form.resetFields();
    onClose();
    closeAddEntryModal();
  };
  return (
    <Modal
      title={t(p("selectCluster"))}
      open={open}
      onOk={onFinish}
      width={400}
      centered
      onCancel={onClose}
      destroyOnClose
    >

      <Form
        form={form}
        wrapperCol={{ span: 18 }}
        labelCol={{ span:6, style:{ textAlign:"left" } }}
      >
        <Form.Item
          rules={[{ required: true }]}
          label={t(p("cluster"))}
          name="cluster"
        >
          <Select
            onChange={handelClusterChange}
            options={clustersOptions}
          />

        </Form.Item>
        {needLoginNode ? (
          <Form.Item
            rules={[{ required: true }]}
            label={t(p("loginNode"))}
            name="loginNode"
          >
            <Select
              options={loginNodesOptions}
            />
          </Form.Item>
        ) : undefined}
      </Form>
    </Modal>
  );
};


