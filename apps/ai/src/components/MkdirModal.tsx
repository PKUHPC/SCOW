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
import { trpc } from "src/utils/trpc";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: (() => void) | ((dirName: string) => Promise<void>);
  clusterId: string;
  path: string;
}

interface FormProps {
  newDirName: string;
}

export const MkdirModal: React.FC<Props> = ({ open, onClose, path, reload, clusterId }) => {
  const t = useI18nTranslateToString();
  const p = prefix("component.mkdirModal.");
  const pCommon = prefix("common.");

  const { message } = App.useApp();
  const [form] = Form.useForm<FormProps>();

  const mutation = trpc.file.mkdir.useMutation({
    onSuccess: () => {
      message.success(t(p("success")));
      reload(form.getFieldValue("newDirName"));
      onClose();
      form.resetFields();
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") {
        message.error(t(p("alreadyExisted")));
      }
      else if (e.data?.code === "TOO_MANY_REQUESTS") {
        message.error(t(pCommon("noSpaceError")));
      }
      else {
        message.error(`${t(p("failed"))}: ${e.message}`);
      }
    },
  });

  const onSubmit = async () => {
    const { newDirName } = await form.validateFields();

    mutation.mutate({
      path: join(path, newDirName), clusterId,
    });
  };

  return (
    <Modal
      open={open}
      title={t(p("mkDir"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={mutation.isPending}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("dirPath"))}>
          <strong>{path}</strong>
        </Form.Item>
        <Form.Item label={t(p("newDirName"))} name="newDirName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
