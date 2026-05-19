import { App, Form, Modal } from "antd";
import React, { useState } from "react";
import { getEmailRule } from "src/utils/form";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";

import { TrimInput as Input } from "../styledAntdCom/TrimInput";
import { mutationType } from "./index";

export interface Props {
  open: boolean;
  onClose: () => void;
  setEmail: (email: string) => void;
  languageId: string;
  api;
  email?: string;
  aiChangeEmail?: mutationType;
}

interface FormInfo {
  newEmail: string;
  oldEmail: string;
}

export const ChangeEmailModal: React.FC<Props> = ({
  open,
  onClose,
  setEmail,
  languageId,
  api,
  email,
  aiChangeEmail,
}) => {
  const [form] = Form.useForm<FormInfo>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const changeEmailMutation = aiChangeEmail?.useMutation({
    onSuccess() {
      form.validateFields().then((res) => {
        setEmail(res?.newEmail);
      });
      onClose();
      setLoading(false);
      message.success(getCurrentLangLibWebText(languageId, "changeEmailSuccess"));
    },
    onError() {
      setLoading(false);
      message.error(getCurrentLangLibWebText(languageId, "changeEmailFail"));
    },
  });

  const onFinish = async () => {
    const { newEmail } = await form.validateFields();
    setLoading(true);

    if (aiChangeEmail) {
      changeEmailMutation?.mutate({ newEmail });
    } else {
      await api
        .changeEmail({ body: { newEmail } })
        .httpError(404, () => {
          message.error(getCurrentLangLibWebText(languageId, "userNotExist"));
        })
        .httpError(500, () => {
          message.error(getCurrentLangLibWebText(languageId, "changeEmailFail"));
        })
        .httpError(501, () => {
          message.error(getCurrentLangLibWebText(languageId, "unavailable"));
        })
        .then(() => {
          form.resetFields();
          onClose();
          setEmail(newEmail);
          message.success(getCurrentLangLibWebText(languageId, "changeEmailSuccess"));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  return (
    <Modal
      title={getCurrentLangLibWebText(languageId, "changeEmail")}
      open={open}
      onOk={form.submit}
      confirmLoading={loading}
      onCancel={onClose}
      destroyOnClose
    >
      <Form initialValues={undefined} layout="vertical" form={form} onFinish={onFinish}>
        <Form.Item label={getCurrentLangLibWebText(languageId, "oldEmail")} name="oldEmail" initialValue={email}>
          <Input disabled />
        </Form.Item>
        <Form.Item
          rules={[{ required: true }, getEmailRule(languageId)]}
          label={getCurrentLangLibWebText(languageId, "newEmail")}
          name="newEmail"
        >
          <Input placeholder={getCurrentLangLibWebText(languageId, "inputEmail")} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
