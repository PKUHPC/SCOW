import { TrimInput as Input } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { Alert, App, Form, Modal } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { ModalLink } from "src/components/ModalLink";
import { prefix, useI18nTranslateToString } from "src/i18n";

interface Props {
  tenantName: string;
  name: string;
  userId: string;
  open: boolean;
  onClose: () => void;
  reload: () => void;
}

interface FormProps {
  newTenantName: string;
}
const p = prefix("pageComp.admin.changeTenantModal.");
const pCommon = prefix("common.");

const ChangeTenantModal: React.FC<Props> = ({ tenantName, name, userId, onClose, reload, open }) => {
  const t = useI18nTranslateToString();
  const { message } = App.useApp();

  const [form] = Form.useForm<FormProps>();
  const [loading, setLoading] = useState(false);

  const onOK = async () => {
    const { newTenantName } = await form.validateFields();
    setLoading(true);
    await api
      .changeTenant({
        body: {
          identityId: userId,
          previousTenantName: tenantName,
          tenantName: newTenantName,
        },
      })
      .httpError(404, (e) => {
        switch (e.code) {
          case "USER_NOT_FOUND":
            message.error(t(p("userNotFound")));
            break;
          case "TENANT_NOT_FOUND":
            message.error(t(p("tenantNotFound")));
            break;
          default:
            message.error(t(pCommon("changeFail")));
        }
      })
      .httpError(409, () => {
        message.error(t(p("userAlreadyExistInThisTenant")));
      })
      .httpError(422, (e) => {
        if (e.code === "USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP") {
          message.error(t(p("userStillMaintainsAccountRelationship")));
        }
        if (e.code === "USER_STILL_MAINTAINS_TENANT_ROLES") {
          message.error(t(p("userStillMaintainsTenantRoles")));
        }
      })
      .then(() => {
        message.success(t(pCommon("changeSuccess")));
        form.resetFields();
        reload();
        onClose();
      })
      .catch(() => {
        message.error(t(pCommon("changeFail")));
      })
      .finally(() => setLoading(false));
  };

  return (
    <Modal title={t(p("modifyTenant"))} open={open} onOk={onOK} confirmLoading={loading} onCancel={onClose} width={550}>
      <Alert banner message={t(p("createTenantWarningInfo"))} type="warning" showIcon />
      <Form form={form} initialValues={undefined} preserve={false}>
        <Form.Item label={t(p("userId"))}>
          <span>{userId}</span>
        </Form.Item>
        <Form.Item label={t(p("userName"))}>
          <span>{name}</span>
        </Form.Item>
        <Form.Item label={t(p("originalTenant"))}>
          <span>{tenantName}</span>
        </Form.Item>
        <Form.Item
          rules={[{ required: true, message: t(p("newTenantNameRequired")) }]}
          label={t(p("newTenant"))}
          name="newTenantName"
        >
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};
export const ChangeTenantModalLink = ModalLink(ChangeTenantModal);
