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
import { dirname, join } from "path";
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

export const RenameModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {
  const t = useI18nTranslateToString();
  const p = prefix("app.files.renameModal.");

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const mutation = trpc.file.copyOrMove.useMutation({
    onSuccess: () => {
      message.success(t(p("success")));
      reload();
      onClose();
      form.resetFields();
    },
    onError: (e) => {
      message.error(e.message || t(p("failed")));
    },
  });

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    mutation.mutate({
      op: "move",
      clusterId: cluster.id,
      fromPath: path, toPath: join(dirname(path), newFileName),
    });
  };

  return (
    <Modal
      open={open}
      title={t(p("rename"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("wannaRename"))}>
          <strong>{path}</strong>
        </Form.Item>
        <Form.Item label={t(p("newFileName"))} name="newFileName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
