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
import { join } from "path";
import { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  reload: () => void;
  cluster: string;
  path: string;
}

interface FormProps {
  newFileName: string;
}

const p = prefix("pageComp.fileManagerComp.mkDirModal.");
const pCommon = prefix("common.");

export const MkdirModal: React.FC<Props> = ({ open, onClose, path, reload, cluster }) => {

  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const t = useI18nTranslateToString();

  const onSubmit = async () => {
    const { newFileName } = await form.validateFields();
    setLoading(true);
    await api.mkdir({ body: { cluster, path: join(path, newFileName) } })
      .httpError(409, () => { message.error(t(p("existedErrorMessage"))); })
      .httpError(429, () => {
        message.error(t(pCommon("noSpaceError")));
      })
      .then(() => {
        message.success(t(p("successMessage")));
        reload();
        onClose();
        form.resetFields();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      open={open}
      title={t(p("title"))}
      okText={t("button.confirmButton")}
      cancelText={t("button.cancelButton")}
      onCancel={onClose}
      confirmLoading={loading}
      destroyOnClose
      onOk={form.submit}
    >
      <Form form={form} onFinish={onSubmit}>
        <Form.Item label={t(p("mkdirLabel"))}>
          <strong>{path}</strong>
        </Form.Item>
        <Form.Item label={t(p("dirName"))} name="newFileName" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
