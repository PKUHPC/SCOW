import { TrimInput } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { App, Form, Input, Modal } from "antd";
import React, { useEffect, useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { CreateUserFormFields } from "src/pageComponents/users/CreateUserForm";
import { getRuntimeI18nConfigText } from "src/utils/config";
import { getUserIdRule } from "src/utils/createUser";
import { confirmPasswordFormItemProps, getEmailRule, passwordRule } from "src/utils/form";

export interface NewUserInfo {
  identityId: string;
  name: string;
}

interface Props {
  newUserInfo: NewUserInfo | undefined;
  accountName: string;
  open: boolean;
  onCreated: (newUserInfo: NewUserInfo) => Promise<void>;
  onClose: () => void;
}
const p = prefix("pageComp.user.createUserModal.");
const pCommon = prefix("common.");

export const CreateUserModal: React.FC<Props> = ({ onCreated, onClose, open, newUserInfo, accountName }) => {
  const t = useI18nTranslateToString();

  const [form] = Form.useForm<CreateUserFormFields>();
  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  const onOk = async () => {
    const { password, email, identityId, name, phone, organization, adminComment } = await form.validateFields();
    setLoading(true);
    await api
      .createUser({
        body: {
          email,
          identityId,
          name: name.trim(),
          password,
          phone,
          organization,
          adminComment,
        },
      })
      .httpError(409, () => {
        message.error(t(p("alreadyExist")));
      })
      .httpError(400, (e) => {
        if (e.code === "USERID_NOT_VALID") {
          message.error(userIdRule?.message);
        }
        if (e.code === "PASSWORD_NOT_VALID") {
          message.error(getRuntimeI18nConfigText(languageId, "passwordPatternMessage"));
        }
        throw e;
      })
      .then(() => {
        return onCreated({ identityId, name });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (newUserInfo) {
      form.setFieldsValue(newUserInfo);
    }
  }, [newUserInfo]);

  const languageId = useI18n().currentLanguage.id;
  const userIdRule = getUserIdRule(languageId);

  return (
    <Modal title={t(p("createUser"))} open={open} onCancel={onClose} confirmLoading={loading} onOk={onOk}>
      <p>
        {t(p("notExist"))} {accountName}。
      </p>
      <Form
        form={form}
        initialValues={newUserInfo}
        labelCol={{ span: 5, style: { whiteSpace: "normal", textAlign: "left", lineHeight: "16px" } }}
      >
        <Form.Item
          label={t(pCommon("userId"))}
          name="identityId"
          rules={[{ required: true }, ...(userIdRule ? [userIdRule] : [])]}
        >
          <TrimInput disabled placeholder={userIdRule?.message} />
        </Form.Item>
        <Form.Item label={t(pCommon("userFullName"))} name="name" rules={[{ required: true }]}>
          <TrimInput />
        </Form.Item>
        <Form.Item label={t(p("email"))} name="email" rules={[{ required: true }, getEmailRule(languageId)]}>
          <TrimInput />
        </Form.Item>
        <Form.Item label={t(p("password"))} name="password" rules={[{ required: true }, passwordRule(languageId)]}>
          <Input.Password placeholder={passwordRule(languageId).message} />
        </Form.Item>
        <Form.Item
          label={t(p("confirm"))}
          name="confirmPassword"
          hasFeedback
          {...confirmPasswordFormItemProps(form, "password", languageId)}
        >
          <Input.Password placeholder={passwordRule(languageId).message} />
        </Form.Item>
        <Form.Item label={t(p("phone"))} name="phone">
          <Input placeholder={t(p("enterPhone"))} />
        </Form.Item>
        <Form.Item
          label={t(p("organization"))}
          name="organization"
          rules={[
            {
              max: 50,
              message: t(p("organizationLength")),
            },
          ]}
        >
          <Input placeholder={t(p("enterOrganization"))} />
        </Form.Item>
        <Form.Item label={t(p("comment"))} name="adminComment">
          <Input.TextArea placeholder={t(p("enterComment"))} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
