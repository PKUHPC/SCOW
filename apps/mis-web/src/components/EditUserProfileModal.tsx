import { Form, Input, Modal } from "antd";
import { useState } from "react";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  name: string;
  userId: string;
  email?: string;
  phone?: string;
  organization?: string;
  adminComment?: string;
  onClose: () => void;
  onComplete: (data: FormProps) => Promise<void>;
  open: boolean;
}

interface FormProps {
  email?: string;
  phone?: string;
  organization?: string;
  adminComment?: string;
}

const p = prefix("component.editUserProfileModal.");

const EditUserProfileModal: React.FC<Props> = ({
  name, userId, email, phone, organization, adminComment, onClose, onComplete, open }) => {

  const t = useI18nTranslateToString();
  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const onOK = async () => {
    const data = await form.validateFields();
    setLoading(true);
    await onComplete(data)
      .then(() => {
        form.resetFields();
        onClose();
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal
      title={t(p("title"), [name, userId])}
      open={open}
      onOk={onOK}
      confirmLoading={loading}
      onCancel={onClose}
      destroyOnClose={true}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={undefined}
        preserve={false}
      >
        <Form.Item
          label={t(p("email"))}
          name="email"
          initialValue={email}
          rules={[{ type: "email", message: t(p("errorEmail")) }]}
        >
          <Input placeholder={t(p("enterEmail"))} />
        </Form.Item>

        <Form.Item
          label={t(p("phone"))}
          name="phone"
          initialValue={phone}
        >
          <Input placeholder={t(p("enterPhone"))} />
        </Form.Item>

        <Form.Item
          label={t(p("organization"))}
          name="organization"
          initialValue={organization}
          rules={[{
            max: 50,
            message: t(p("organizationLength")),
          }]}
        >
          <Input placeholder={t(p("enterOrganization"))} />
        </Form.Item>

        <Form.Item
          label={t(p("comment"))}
          name="adminComment"
          initialValue={adminComment}
        >
          <Input.TextArea placeholder={t(p("enterComment"))} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export const EditUserProfileModalLink = ModalLink(EditUserProfileModal);
