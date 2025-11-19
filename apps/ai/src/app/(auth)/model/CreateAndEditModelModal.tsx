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
  modelId: number;
  modelName: string;
  algorithmName?: string;
  algorithmFramework?: Framework;
  modalDescription?: string;
}
export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  editData?: EditProps;
}

interface FormFields {
  modelName: string,
  cluster: Cluster,
  algorithmName: string,
  algorithmFramework: Framework,
  modalDescription: string,
}

export const CreateAndEditModalModal: React.FC<Props> = (
  { open, onClose, refetch, editData },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.model.createAndEditModelModal.");
  const pCommon = prefix("common.");
  const languageId = useI18n().currentLanguage.id;

  const AlgorithmTypeTextTrans = {
    ...AlgorithmTypeText,
    [Framework.OTHER]:getAlgorithmTexts(t).other,
  };

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const createModelMutation = trpc.model.createModel.useMutation({
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
            name: "modelName",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
        return;
      }
      message.error(t(p("addFailed")));
    } });

  const updateModelMutation = trpc.model.updateModel.useMutation({
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
            name: "modelName",
            errors: [t(p("alreadyExisted"))],
          },
        ]);
      }
      else if (e.data?.code === "NOT_FOUND") {
        message.error(t(p("notFound")));
      }
      else if (e.data?.code === "PRECONDITION_FAILED") {
        message.error(t(p("tryLater")));
      }
      else {
        message.error(t(p("editFailed")));

      }
    } });

  const onOk = async () => {
    const { modelName:formModalName, cluster, algorithmName:formAlgorithmName,
      algorithmFramework:formAlgorithmFramework, modalDescription:formModalDescription } =
    await form.validateFields();

    if (editData?.modelId) {
      updateModelMutation.mutate({
        id:editData.modelId,
        name:formModalName,
        algorithmName:formAlgorithmName,
        algorithmFramework:formAlgorithmFramework,
        description:formModalDescription,
      });
    } else {
      createModelMutation.mutate({
        name:formModalName,
        algorithmName:formAlgorithmName,
        algorithmFramework:formAlgorithmFramework,
        description:formModalDescription,
        clusterId:cluster.id,
      });
    }
  };

  return (
    <Modal
      title={editData?.modelName ? t(p("edit")) : t(p("add"))}
      open={open}
      onOk={form.submit}
      confirmLoading={createModelMutation.isLoading}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 19 }}
        labelCol={{ span: 5 }}
      >
        <Form.Item
          label={t(p("name"))}
          name="modelName"
          rules={[
            { required: true },
            createNoChineseValidator(t(pCommon("noChinese"))),
            createResourceNameValidator(t(pCommon("resourceNameRuleTips"))),
          ]}
          initialValue={editData?.modelName}
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
          label={t(p("algorithmName"))}
          name="algorithmName"
          initialValue={editData?.algorithmName}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label={t(p("algorithmFramework"))}
          name="algorithmFramework"
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
          name="modalDescription"
          initialValue={editData?.modalDescription}
        >
          <Input.TextArea />
        </Form.Item>
      </Form>
    </Modal>
  );
};
