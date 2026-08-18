import { App, Form, Input, Modal } from "antd";
import { useTranslation } from "react-i18next";
import { useChangeProfileEmailMutation } from "src/features/profile/queries";
import { ProfileApiError } from "src/features/profile/types";

interface FormInfo {
  oldEmail?: string;
  newEmail: string;
}

const getErrorKey = (error: unknown) => {
  if (!(error instanceof ProfileApiError)) return "unknown";
  return error.code;
};

export function ChangeEmailModal({ email, open, onClose }: { email?: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("profile");
  const { message } = App.useApp();
  const [form] = Form.useForm<FormInfo>();
  const changeEmailMutation = useChangeProfileEmailMutation();

  const showError = (error: unknown) => {
    switch (getErrorKey(error)) {
      case "USER_NOT_FOUND":
        void message.error(t("errors.userNotFound", "用户不存在"));
        break;
      case "UNAVAILABLE":
        void message.error(t("errors.unavailable", "本功能在当前配置下不可用"));
        break;
      default:
        void message.error(t("email.changeFailed", "修改邮箱失败"));
    }
  };

  const submit = async () => {
    const { newEmail } = await form.validateFields();
    changeEmailMutation.mutate(newEmail, {
      onSuccess: () => {
        form.resetFields();
        onClose();
        void message.success(t("email.changeSuccess", "邮箱更改成功！"));
      },
      onError: showError,
    });
  };

  return (
    <Modal
      title={t("email.change", "修改邮箱")}
      open={open}
      onOk={() => void submit()}
      confirmLoading={changeEmailMutation.isPending}
      onCancel={onClose}
      destroyOnClose
    >
      <Form layout="vertical" form={form}>
        <Form.Item label={t("email.old", "原邮箱")} name="oldEmail" initialValue={email}>
          <Input disabled />
        </Form.Item>
        <Form.Item
          rules={[
            { required: true, message: t("email.required", "请输入新邮箱") },
            { type: "email", message: t("email.invalid", "邮箱格式不正确，请重新输入") },
          ]}
          label={t("email.new", "新邮箱")}
          name="newEmail"
        >
          <Input placeholder={t("email.placeholder", "请输入新邮箱")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
