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

"use client";

import { App, Form, Input, Modal } from "antd";
import { join } from "path";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { Cluster } from "src/server/trpc/route/config";
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: Cluster;
  path: string;
}

interface FormProps {
  newFileName: string;
}

export const CreateFileModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.createFileModal.");

  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();

  const mutation = trpc.file.createFile.useMutation({
    onSuccess: () => {
      message.success(t(p("success")));
      reload();
      onClose();
      form.resetFields();
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExist")));
      } else {
        throw e;
      }
    },
  });

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();

    mutation.mutate({ path: join(path, newFileName), clusterId: cluster.id });
  };

  return (
    <Modal
      open={open}
      title={t(p("createFile"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("dir"))}>
          <strong>{path}</strong>
        </Form.Item>
        <Form.Item label={t(p("name"))} name="newFileName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
