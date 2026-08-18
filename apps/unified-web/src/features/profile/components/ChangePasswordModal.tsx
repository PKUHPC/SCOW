import { App, Form, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import { useChangeProfilePasswordMutation } from "src/features/profile/queries";
import { ProfileApiError } from "src/features/profile/types";

interface FormInfo {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({
  open,
  passwordPattern,
  passwordPatternMessage,
  onClose,
}: {
  open: boolean;
  passwordPattern?: string;
  passwordPatternMessage?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("profile");
  const { message } = App.useApp();
  const [form] = Form.useForm<FormInfo>();
  const changePasswordMutation = useChangeProfilePasswordMutation();

  const showError = (error: unknown) => {
    const code = error instanceof ProfileApiError ? error.code : "UNKNOWN";
    switch (code) {
      case "OLD_PASSWORD_INCORRECT":
        void message.error(t("password.oldIncorrect", "原密码错误"));
        break;
      case "PASSWORD_NOT_VALID":
        void message.error(passwordPatternMessage ?? t("password.invalid", "新密码不符合密码规则"));
        break;
      case "USER_NOT_FOUND":
        void message.error(t("errors.userNotFound", "用户不存在"));
        break;
      case "UNAVAILABLE":
        void message.error(t("errors.unavailable", "本功能在当前配置下不可用"));
        break;
      default:
        void message.error(t("password.changeFailed", "修改密码失败"));
    }
  };

  const submit = async () => {
    const values = await form.validateFields();
    changePasswordMutation.mutate(values, {
      onSuccess: () => {
        form.resetFields();
        onClose();
        void message.success(t("password.changeSuccess", "密码更改成功"));
      },
      onError: showError,
    });
  };

  return (
    <Modal
      title={t("password.change", "修改密码")}
      open={open}
      onOk={() => void submit()}
      confirmLoading={changePasswordMutation.isPending}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        labelCol={{ span: 5, style: { whiteSpace: "normal", textAlign: "left", lineHeight: "16px" } }}
        wrapperCol={{ span: 19 }}
      >
        <Form.Item
          rules={[{ required: true, message: t("password.oldRequired", "请输入原密码") }]}
          label={t("password.old", "原密码")}
          name="oldPassword"
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          rules={[
            { required: true, message: t("password.newRequired", "请输入新密码") },
            ...(passwordPattern ? [{ pattern: new RegExp(passwordPattern), message: passwordPatternMessage }] : []),
          ]}
          label={t("password.new", "新密码")}
          name="newPassword"
        >
          <Input.Password placeholder={passwordPatternMessage} />
        </Form.Item>
        <Form.Item
          dependencies={["newPassword"]}
          label={t("password.confirm", "确认密码")}
          name="confirmPassword"
          rules={[
            { required: true, message: t("password.confirmRequired", "请确认密码") },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue("newPassword") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(t("password.mismatch", "两次密码输入不一致，请重新输入"))),
            }),
          ]}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
}
