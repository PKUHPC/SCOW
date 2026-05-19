import { App, Form, Input, Modal } from "antd";
import React, { useState } from "react";
import { confirmPasswordFormItemProps } from "src/utils/form";
import { getCurrentLangLibWebText } from "src/utils/libWebI18n/libI18n";

import { mutationType } from "./index";

export interface Props {
  open: boolean;
  onClose: () => void;
  publicConfig;
  languageId: string;
  userId?: string;
  api?;
  passwordPatternMessage?: string;
  aiChangePassword?: mutationType;
}

interface FormInfo {
  oldPassword: string;
  newPassword: string;
}

export const ChangePasswordModal: React.FC<Props> = ({
  open,
  onClose,
  publicConfig,
  languageId,
  api,
  userId,
  passwordPatternMessage,
  aiChangePassword,
}) => {
  const [form] = Form.useForm<FormInfo>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const passwordRule = {
    pattern: publicConfig.PASSWORD_PATTERN ? new RegExp(publicConfig.PASSWORD_PATTERN) : undefined,
    message: passwordPatternMessage,
  };

  const changePasswordMutation = aiChangePassword?.useMutation({
    onSuccess() {
      form.resetFields();
      setLoading(false);
      onClose();
      message.success(getCurrentLangLibWebText(languageId, "successMessage"));
    },
    onError(e) {
      setLoading(false);
      if (e.data?.code === "BAD_REQUEST") {
        message.error(getCurrentLangLibWebText(languageId, "failMessage"));
      } else if (e.data?.code === "CONFLICT") {
        message.error(getCurrentLangLibWebText(languageId, "errorMessage"));
      } else {
        message.error(getCurrentLangLibWebText(languageId, "failMessage"));
      }
    },
  });

  const onFinish = async () => {
    const { oldPassword, newPassword } = await form.validateFields();
    setLoading(true);
    if (aiChangePassword) {
      changePasswordMutation?.mutate({ identityId: userId, oldPassword, newPassword });
    } else {
      api
        .checkPassword({ query: { password: oldPassword } })
        .httpError(404, () => {
          message.error(getCurrentLangLibWebText(languageId, "userNotExist"));
        })
        .httpError(501, () => {
          message.error(getCurrentLangLibWebText(languageId, "unavailable"));
        })
        .then((result) => {
          if (result.success) {
            return api
              .changePassword({ body: { newPassword } })
              .httpError(400, (e) => {
                if (e.code === "PASSWORD_NOT_VALID") {
                  message.error(passwordPatternMessage);
                }
              })
              .httpError(404, () => {
                message.error(getCurrentLangLibWebText(languageId, "userNotExist"));
              })
              .httpError(501, () => {
                message.error(getCurrentLangLibWebText(languageId, "unavailable"));
              })
              .then(() => {
                form.resetFields();
                onClose();
                message.success(getCurrentLangLibWebText(languageId, "successMessage"));
              });
          } else {
            message.error(getCurrentLangLibWebText(languageId, "errorMessage"));
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  return (
    <Modal
      title={getCurrentLangLibWebText(languageId, "changePassword")}
      open={open}
      onOk={form.submit}
      confirmLoading={loading}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={onFinish}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4, style: { whiteSpace: "normal", textAlign: "left", lineHeight: "16px" } }}
      >
        <Form.Item
          rules={[{ required: true }]}
          label={getCurrentLangLibWebText(languageId, "oldPassword")}
          name="oldPassword"
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          rules={[{ required: true }, passwordRule]}
          label={getCurrentLangLibWebText(languageId, "newPassword")}
          name="newPassword"
        >
          <Input.Password placeholder={passwordRule.message} />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={getCurrentLangLibWebText(languageId, "confirm")}
          hasFeedback
          {...confirmPasswordFormItemProps(form, "newPassword", languageId)}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};
