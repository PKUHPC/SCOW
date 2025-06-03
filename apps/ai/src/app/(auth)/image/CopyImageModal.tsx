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

import { App, Form, Input, Modal } from "antd";
import React from "react";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { imageNameValidation, imageTagValidation } from "src/utils/form";
import { trpc } from "src/utils/trpc";


export interface Props {
  open: boolean;
  onClose: () => void;
  refetch: () => void;
  copiedId: number;
  copiedName: string;
  copiedTag: string;
  copiedClusterId?: string;
}

interface FormFields {
  newName: string,
  newTag: string,
}

export const CopyImageModal: React.FC<Props> = (
  { open, onClose, refetch, copiedId, copiedName, copiedTag,copiedClusterId },
) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.image.copyImageModal.");

  const [form] = Form.useForm<FormFields>();
  const { message } = App.useApp();

  const initialValues = {
    newName: copiedName,
    newTag: copiedTag,
  };

  const copyMutation = trpc.image.copyImage.useMutation({
    onSuccess() {
      message.success(t(p("success")));
      onClose();
      form.resetFields();
      refetch();
    },
    onError(e) {
      message.error(`${t(p("failed"))}:${e.message}`);
    },
  });

  const onOk = async () => {
    form.validateFields();
    const { newName, newTag } = await form.validateFields();
    copyMutation.mutate({
      id: copiedId,
      newName,
      newTag,
      clusterId:copiedClusterId,
    });
  };

  return (
    <Modal
      title={t(p("copy"))}
      open={open}
      onOk={form.submit}
      confirmLoading={copyMutation.isLoading}
      onCancel={onClose}
      width={800}
    >
      <Form
        form={form}
        onFinish={onOk}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4 }}
        initialValues={{ ...initialValues }}
      >
        <Form.Item
          label={t(p("name"))}
          name="newName"
          rules={[
            { required: true },
            { validator: imageNameValidation },
          ]}
        >
          <Input allowClear />
        </Form.Item>
        <Form.Item
          label={t(p("tag"))}
          name="newTag"
          rules={[
            { required: true },
            { validator: imageTagValidation },
          ]}
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
