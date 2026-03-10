import { TrimInput } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { Form, Input } from "antd";
import React from "react";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getUserIdRule, useBuiltinCreateUser } from "src/utils/createUser";
import { confirmPasswordFormItemProps, getEmailRule, passwordRule } from "src/utils/form";

export interface CreateUserFormFields {
  identityId: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string;
  organization?: string;
  adminComment?: string;
}

const p = prefix("pageComp.user.createUserForm.");
const pCommon = prefix("common.");

export const CreateUserForm: React.FC = () => {

  const t = useI18nTranslateToString();

  const form = Form.useFormInstance<CreateUserFormFields>();

  const languageId = useI18n().currentLanguage.id;
  const userIdRule = getUserIdRule(languageId);

  return (
    <>
      <Form.Item
        label={t(pCommon("userId"))}
        name="identityId"
        rules={[
          { required: true },
          ...userIdRule ? [userIdRule] : [],
        ]}

      >
        <TrimInput placeholder={userIdRule?.message} />
      </Form.Item>
      <Form.Item
        label={t(pCommon("userFullName"))}
        name="name"
        rules={[
          { required: true },
          { max: 50 },
        ]}
      >
        <TrimInput />
      </Form.Item>
      <Form.Item
        label={t(p("email"))}
        name="email"
        rules={[{ required: true }, getEmailRule(languageId)]}
      >
        <TrimInput />
      </Form.Item>
      <Form.Item
        label={t(p("password"))}
        name="password"
        rules={[{ required:true }, passwordRule(languageId)]}
      >
        <Input.Password placeholder={passwordRule(languageId).message} />
      </Form.Item>
      {
        useBuiltinCreateUser() ? (
          <>
            <Form.Item
              label={t(p("confirm"))}
              name="confirmPassword"
              hasFeedback
              {...confirmPasswordFormItemProps(form, "password", languageId)}
            >
              <Input.Password placeholder={passwordRule(languageId).message} />
            </Form.Item>
          </>
        ) : undefined

      }
      <Form.Item
        label={t(p("phone"))}
        name="phone"
      >
        <TrimInput placeholder={t(p("enterPhone"))} />
      </Form.Item>
      <Form.Item
        label={t(p("organization"))}
        name="organization"
        rules={[{
          max: 50,
          message: t(p("organizationLength")),
        }]}
      >
        <TrimInput placeholder={t(p("enterOrganization"))} />
      </Form.Item>
      <Form.Item
        label={t(p("comment"))}
        name="adminComment"
      >
        <Input.TextArea placeholder={t(p("enterComment"))} />
      </Form.Item>
    </>
  );
};
