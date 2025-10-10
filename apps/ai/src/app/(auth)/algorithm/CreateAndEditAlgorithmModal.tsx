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

import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import { App, Form, Input, Modal, Select } from "antd";
import React from "react";
import { SingleClusterSelector } from "src/components/ClusterSelector";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { AlgorithmTypeText, Framework, getAlgorithmTexts } from "src/models/Algorithm";
import { Cluster } from "src/server/trpc/route/config";
import { createNoChineseValidator, createResourceNameValidator } from "src/utils/form";
import { trpc } from "src/utils/trpc";

interface EditProps {
  cluster?: Cluster;
  algorithmName: string;
  algorithmId: number;
  algorithmFramework: Framework;
  algorithmDescription?: string;
}
export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  editData?: EditProps;
}
type AlgorithmType = keyof typeof AlgorithmTypeText;

interface FormFields {
  name: string,
  type: AlgorithmType,
  cluster: Cluster,
  description?: string,
}

export const CreateAndEditAlgorithmModal: React.FC<Props> = (
  { open, onClose, refetch, editData },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.algorithm.createAndEditAlgorithmModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const AlgorithmTypeTextTrans = {
    ...AlgorithmTypeText,
    [Framework.OTHER]:getAlgorithmTexts(t).other,
  };

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const createAlgorithmMutation = trpc.algorithm.createAlgorithm.useMutation({
    onSuccess() {
      message.success(t(p("addSuccessfully")));
      form.resetFields();
      refetch();
      onClose();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExisted")));
        form.setFields([
          {
            name: "name",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
      } else {
        message.error(t(p("addFailed")));
      }
    } });

  const updateAlgorithmMutation = trpc.algorithm.updateAlgorithm.useMutation({
    onSuccess() {
      message.success(t(p("editSuccessfully")));
      refetch();
      onClose();
    },
    onError(e) {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExisted")));
        form.setFields([
          {
            name: "name",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
      } else if (e.data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      } else if (e.data?.code === "PRECONDITION_FAILED") {
        message.error(t(p("tryLater")));
      } else {
        message.error(t(p("editFailed")));
      }
    } });

  const onOk = async () => {
    const { name, type, description, cluster } = await form.validateFields();

    if (editData?.algorithmName) {
      updateAlgorithmMutation.mutate({
        id:editData.algorithmId, name, framework:type, description,
      });
    } else {
      createAlgorithmMutation.mutate({
        name, framework:type, description, clusterId:cluster.id,
      });
    }
  };

  return (
    <Modal
      title={editData?.algorithmName ? t(p("edit")) : t(p("add"))}
      open={open}
      onOk={form.submit}
      confirmLoading={createAlgorithmMutation.isLoading || updateAlgorithmMutation.isLoading}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 17 }}
        labelCol={{ span: 5 }}
      >
        <Form.Item
          label={t(p("name"))}
          name="name"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
          initialValue={editData?.algorithmName}
        >
          <Input />
        </Form.Item>
        {editData?.cluster ? (
          <Form.Item
            label={t(p("cluster"))}
          >
            {getI18nConfigCurrentText(editData?.cluster?.name, languageId)}
          </Form.Item>
        ) : (
          <Form.Item
            label={t(p("cluster"))}
            name="cluster"
            rules={[
              { required: true },
            ]}
          >
            <SingleClusterSelector />
          </Form.Item>
        )}

        <Form.Item
          label={t(p("framework"))}
          name="type"
          rules={[
            { required: true },
          ]}
          initialValue={editData?.algorithmFramework}
        >
          <Select
            style={{ minWidth: "120px" }}
            options={
              Object.entries(AlgorithmTypeTextTrans).map(([key, value]) => ({ label:value, value:key }))}
          >
          </Select>
        </Form.Item>
        <Form.Item
          label={t(p("description"))}
          name="description"
          initialValue={editData?.algorithmDescription}
        >
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
