/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { FormLayout } from "@scow/lib-web/build/layouts/FormLayout";
import { App, Button, Form } from "antd";
import { NextPage } from "next";
import React, { useState } from "react";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { NotFoundPage } from "src/components/errorPages/NotFoundPage";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { TenantRole } from "src/models/User";
import { CreateUserForm, CreateUserFormFields } from "src/pageComponents/users/CreateUserForm";
import { getRuntimeI18nConfigText } from "src/utils/config";
import { getUserIdRule, useBuiltinCreateUser } from "src/utils/createUser";
import { Head } from "src/utils/head";

const p = prefix("page.tenant.users.create.");

const CreateUserPageForm: React.FC = () => {

  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const userIdRule = getUserIdRule(languageId);

  const [form] = Form.useForm<CreateUserFormFields>();
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(false);

  const onOk = async () => {
    const { password, email, identityId, name } = await form.validateFields();
    setLoading(true);

    const result = await api.userExists({ body: { identityId } });
    if (result.existsInScow) {
      modal.error({
        title: t(p("userExist")),
        content: t(p("userExistMessage")),
        okText: t("common.ok"),
        onOk: async () => {
          setLoading(false);
        },
      });
    } else {
      modal.confirm({
        title: result.existsInAuth !== undefined ?
          result.existsInAuth ? t(p("userExistAuth")) : t(p("userNotExistAuth"))
          : t(p("unableDetermineUserExistAuth")),
        content: result.existsInAuth ?
          t(p("userExistAuthMessage"))
          : t(p("userNotExistAuthMessage")),
        okText: t("common.ok"),
        onOk: async () => {
          await api.createUser({ body: { email, identityId, name: name.trim(), password } })
            .httpError(409, () => {
              modal.error({
                title: t("common.addFail"),
                content: t(p("userExistInSCOWDatabaseMessage")),
                okText: t("common.ok"),
              });
            })
            .httpError(400, (e) => {
              if (e.code === "USERID_NOT_VALID") {
                message.error(userIdRule?.message);
              };
              if (e.code === "PASSWORD_NOT_VALID") {
                message.error(getRuntimeI18nConfigText(languageId, "passwordPatternMessage"));
              };
              throw e;
            })
            .then((createdInAuth) => {
              if (createdInAuth.createdInAuth) {
                message.success(t(p("addCompleted")));
                api.updatePasswordResetFlag({
                  body: {
                    userId: identityId,
                    forceFlag: true,
                  },
                }).catch((e) => { console.log(e); });
              } else {
                modal.info({
                  title: t("common.addSuccess"),
                  content: t(p("userExistAndAddToSCOWDatabaseMessage")),
                  okText: t("common.ok"),
                });
              }
            })
            .catch(() => {
              modal.error({
                title: t("common.addFail"),
                content: t(p("createUserFail")),
              });
            })
            .finally(() => {
              form.resetFields();
              setLoading(false);
            });
        },
        onCancel: async () => {
          setLoading(false);
        },
      });
    }
  };

  return (
    <Form
      form={form}
      wrapperCol={{ span: 20 }}
      labelAlign="left"
      onFinish={onOk}
      labelCol={{ span:4, style: { whiteSpace:"normal", textAlign:"left", lineHeight:"16px" } }}
    >
      <CreateUserForm />
      <Form.Item wrapperCol={{ span: 6, offset: 4 }}>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t("common.submit")}
        </Button>
      </Form.Item>
    </Form>
  );
};

export const CreateUserPage: NextPage = requireAuth((i) => i.tenantRoles.includes(TenantRole.TENANT_ADMIN))(
  () => {

    const t = useI18nTranslateToString();

    if (!useBuiltinCreateUser()) {
      return <NotFoundPage />;
    }

    return (
      <div>
        <Head title={t(p("crateUser"))} />
        <PageTitle titleText={t(p("crateUser"))} />
        <FormLayout>
          <CreateUserPageForm />
        </FormLayout>
      </div>
    );
  });

export default CreateUserPage;
