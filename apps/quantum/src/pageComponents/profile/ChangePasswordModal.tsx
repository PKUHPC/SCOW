import { App, Form, Input, Modal } from "antd";
import React from "react";
import { usePublicConfig } from "src/context/PublicConfigContext";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { confirmPasswordFormItemProps } from "src/utils/form";
import { trpc } from "src/utils/trpc";

export interface Props {
  open: boolean;
  onClose: () => void;
  identityId: string;
}

interface FormInfo {
  oldPassword: string;
  newPassword: string;
}

export const ChangePasswordModal: React.FC<Props> = ({ open, onClose, identityId }) => {
  const t = useI18nTranslateToString();
  const p = prefix("page.profile.");

  const publicConfig = usePublicConfig();
  const [form] = Form.useForm<FormInfo>();
  const { message } = App.useApp();

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess() {
      message.success(t(p("cPSuccessfully")));
      form.resetFields();
      onClose();
    },
    onError(e) {
      if (e.data?.code === "BAD_REQUEST") {
        message.error(`${t(p("cPFailed"))}: ${e.message}`);
      } else if (e.data?.code === "CONFLICT") {
        message.error(t(p("originalPwError")));
      } else {
        message.error(t(p("cPFailed")));
      }
    },
  });

  const onFinish = async () => {
    const { oldPassword, newPassword } = await form.validateFields();
    changePasswordMutation.mutate({ identityId, oldPassword, newPassword });
  };

  return (
    <Modal
      title={t(p("changePassword"))}
      open={open}
      onOk={form.submit}
      confirmLoading={changePasswordMutation.isPending}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={onFinish}
        wrapperCol={{ span: 20 }}
        labelCol={{ span: 4, style: { whiteSpace: "normal", textAlign: "left", lineHeight: "16px" } }}
      >
        <Form.Item rules={[{ required: true }]} label={t(p("originalPw"))} name="oldPassword">
          <Input.Password />
        </Form.Item>
        <Form.Item
          rules={[
            { required: true },
            {
              pattern: publicConfig.publicConfig.PASSWORD_PATTERN
                ? new RegExp(publicConfig.publicConfig.PASSWORD_PATTERN)
                : undefined,
            },
          ]}
          label={t(p("newPw"))}
          name="newPassword"
        >
          <Input.Password placeholder={t(p("newPwPlaceholder"))} />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t("button.confirmButton")}
          hasFeedback
          {...confirmPasswordFormItemProps(form, "newPassword", "zh_cn")}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};
