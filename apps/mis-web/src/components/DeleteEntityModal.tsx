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

import { Form, Input, message, Modal } from "antd";
import { useState } from "react";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  name: string;
  id: string;
  onClose: () => void;
  onComplete: (id: string, name: string, comments: string) => Promise<void>;
  open: boolean;
  type: "USER" | "ACCOUNT";
}

interface FormProps {
  id: string;
  name: string;
  comments: string;
}

const p = prefix("component.deleteModals.");

const DeleteEntityModal: React.FC<Props> = ({ name, id, onClose, onComplete, open, type }) => {
  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const formItems = {
    USER: [
      {
        label: t(p("userId")),
        name: "id",
        rules: [{ required: true, message: t(p("userIdRequired")) }],
      },
      {
        label: t(p("userName")),
        name: "name",
        rules: [{ required: true, message: t(p("userNameRequired")) }],
      },
    ],
    ACCOUNT: [
      {
        label: t(p("accountName")),
        name: "name",
        rules: [{ required: true, message: t(p("accountNameRequired")) }],
      },
      {
        label: t(p("accountOwnerId")),
        name: "id",
        rules: [{ required: true, message: t(p("ownerIdRequired")) }],
      },
    ],
  };

  type DeletePrompt1Type = "confirmDeleteUserPrompt1" | "confirmDeleteAccountPrompt1";
  type DeletePrompt2Type = "confirmDeleteUserPrompt2" | "confirmDeleteAccountPrompt2";

  const formParams: Record<string, { labelCol: number; wrapperCol: number; deletePrompt1: DeletePrompt1Type;
    deletePrompt2: DeletePrompt2Type }> = {
    USER: {
      labelCol: 4,
      wrapperCol: 20,
      deletePrompt1: "confirmDeleteUserPrompt1",
      deletePrompt2: "confirmDeleteUserPrompt2",
    },
    ACCOUNT: {
      labelCol: 6,
      wrapperCol: 16,
      deletePrompt1: "confirmDeleteAccountPrompt1",
      deletePrompt2: "confirmDeleteAccountPrompt2",
    },
  };

  const { labelCol, wrapperCol, deletePrompt1, deletePrompt2 } = formParams[type];

  const onOK = async () => {
    try {
      const { id: inputId, name: inputName, comments = "" } = await form.validateFields();
      const trimmedId = inputId.trim();
      const trimmedName = inputName.trim();
      const trimmedComments = comments.trim();

      if (trimmedId !== id || trimmedName !== name) {
        message.error(t(p("incorrectUserIdOrName")));
        return;
      }
      setLoading(true);
      await onComplete(trimmedId, trimmedName, trimmedComments)
        .then(() => {
          form.resetFields();
          onClose();
        })
        .finally(() => setLoading(false));
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <Modal
      title={`${t(p(type === "USER" ? "deleteUser" : "deleteAccount"))}`}
      open={open}
      onOk={onOK}
      confirmLoading={loading}
      onCancel={onClose}
      width={"620px"} // 设置Modal宽度
    >
      <br />
      <div
        dangerouslySetInnerHTML={{
          __html: type === "USER"
            ? t(p("confirmPermanentDeleteUser"), [id, name])
            : t(p("confirmPermanentDeleteAccount"), [name, id]),
        }}
      /><br />
      <div dangerouslySetInnerHTML={{ __html: t(p(deletePrompt1)) }} /><br />
      <p><b dangerouslySetInnerHTML={{ __html: t(p(deletePrompt2)) }} /></p><br />
      <Form
        form={form}
        initialValues={undefined}
        preserve={false}
        layout="horizontal"
        style={{ maxWidth: "100%" }}
      >
        {formItems[type].map((item) => (
          <Form.Item
            key={item.name}
            label={item.label}
            name={item.name}
            rules={item.rules}
            labelCol={{ span: labelCol }}
            wrapperCol={{ span: wrapperCol }}
            style={{ marginBottom: 16 }}
            labelAlign="left"
          >
            <Input />
          </Form.Item>
        ))}
        <Form.Item
          label={t(p("comments"))}
          name="comments"
          labelCol={{ span: labelCol }}
          wrapperCol={{ span: wrapperCol }}
          style={{ marginBottom: 16 }}
          labelAlign="left"
        >
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const DeleteEntityModalLink = ModalLink(DeleteEntityModal);
