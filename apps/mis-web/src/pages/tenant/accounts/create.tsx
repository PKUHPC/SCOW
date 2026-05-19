import { TrimInput } from "@scow/lib-web/build/components/styledAntdCom/TrimInput";
import { FormLayout } from "@scow/lib-web/build/layouts/FormLayout";
import { App, Button, Form, Input } from "antd";
import { NextPage } from "next";
import React, { useState } from "react";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { getRuntimeI18nConfigText, publicConfig } from "src/utils/config";
import { getUserIdRule } from "src/utils/createUser";
import { Head } from "src/utils/head";

interface FormProps {
  ownerId: string;
  ownerName: string;
  accountName: string;
  comment?: string;
}

interface CreateAccountFormProps {
  tenantName: string;
}

const p = prefix("page.tenant.accounts.create.");

const CreateAccountForm: React.FC<CreateAccountFormProps> = ({ tenantName }) => {
  const languageId = useI18n().currentLanguage.id;
  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormProps>();

  const [loading, setLoading] = useState(false);

  const { message } = App.useApp();

  const submit = async () => {
    const { accountName, ownerId, ownerName, comment } = await form.validateFields();
    setLoading(true);
    message.open({
      type: "loading",
      content: t("common.waitingMessage"),
      duration: 0,
      key: "createAccount",
    });
    await api
      .createAccount({
        body: {
          accountName: accountName.trim(),
          ownerId: ownerId.trim(),
          ownerName: ownerName.trim(),
          comment,
        },
      })
      .httpError(404, () => {
        message.error(t(p("tenantNotExistUser"), [tenantName, ownerId]));
      })
      .httpError(409, (e) => {
        if (e.code === "ALREADY_EXISTS") {
          message.error(t(p("accountNameOccupied")));
        } else if (e.code === "FAILED_PRECONDITION") {
          message.error(t("common.accountUserSyncRunning"));
        } else {
          message.error(t(p("createAccountFailed")));
        }
      })
      .httpError(400, () => {
        message.error(t(p("userIdAndNameNotMatch")));
      })
      .httpError(401, (e) => {
        message.error(e.message);
      })
      .then(() => {
        message.success(t(p("createSuccess")));
        form.resetFields();
      })
      .finally(() => {
        message.destroy("createAccount");
        setLoading(false);
      });
  };

  const userIdRule = getUserIdRule(languageId);

  return (
    <Form
      form={form}
      wrapperCol={{ span: 20 }}
      labelCol={{ span: 5, style: { whiteSpace: "normal", textAlign: "left", lineHeight: "16px" } }}
      labelAlign="right"
      onFinish={submit}
    >
      <Form.Item
        name="accountName"
        label={t("common.accountName")}
        rules={[
          { required: true },
          ...(publicConfig.ACCOUNT_NAME_PATTERN
            ? [
                {
                  pattern: new RegExp(publicConfig.ACCOUNT_NAME_PATTERN),
                  message: getRuntimeI18nConfigText(languageId, "accountNamePatternMessage"),
                },
              ]
            : []),
        ]}
      >
        <TrimInput />
      </Form.Item>
      <Form.Item
        name="ownerId"
        label={t(p("ownerUserId"))}
        rules={[{ required: true }, ...(userIdRule ? [userIdRule] : [])]}
      >
        <TrimInput />
      </Form.Item>
      <Form.Item name="ownerName" label={t(p("ownerName"))} rules={[{ required: true }]}>
        <TrimInput />
      </Form.Item>
      <Form.Item name="comment" label={t(p("remark"))}>
        <Input.TextArea />
      </Form.Item>
      <Form.Item wrapperCol={{ span: 6, offset: 5 }}>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t("common.submit")}
        </Button>
      </Form.Item>
    </Form>
  );
};

export const CreateAccountPage: NextPage = requireAuth((i) => i.tenantRoles.includes(TenantRole.TENANT_ADMIN))(({
  userStore,
}) => {
  const t = useI18nTranslateToString();

  return (
    <div>
      <Head title={t(p("createAccount"))} />
      <PageTitle titleText={t(p("createAccount"))} />
      <FormLayout>
        <CreateAccountForm tenantName={userStore.user.tenant} />
      </FormLayout>
    </div>
  );
});

export default CreateAccountPage;
