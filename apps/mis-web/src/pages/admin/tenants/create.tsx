import { FormLayout } from "@scow/lib-web/build/layouts/FormLayout";
import { App, Button, Form } from "antd";
import { NextPage } from "next";
import React, { useState } from "react";
import { api } from "src/apis";
import { requireAuth } from "src/auth/requireAuth";
import { PageTitle } from "src/components/PageTitle";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { PlatformRole } from "src/models/User";
import { CreateTenantForm, CreateTenantFormFields, UserType } from "src/pageComponents/admin/CreateTenantForm";
import { getRuntimeI18nConfigText } from "src/utils/config";
import { getUserIdRule, useBuiltinCreateUser } from "src/utils/createUser";
import { Head } from "src/utils/head";

const p = prefix("page.admin.tenants.create.");

const CreateTenantPageForm: React.FC = () => {
  const [form] = Form.useForm<CreateTenantFormFields>();
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(false);
  const t = useI18nTranslateToString();
  const languageId = useI18n().currentLanguage.id;
  const userIdRule = getUserIdRule(languageId);

  const onOk = async () => {
    const { tenantName, userId, userName, userEmail, userPassword, userType } = await form.validateFields();
    setLoading(true);

    // 新建租户的租户管理员为已存在的用户
    if (userType === UserType.Existing) {
      await api
        .createTenantWithExistingUserAsAdmin({
          body: {
            tenantName: tenantName.trim(),
            userId,
            userName: userName.trim(),
          },
        })
        .httpError(409, () => {
          message.error({
            content: t(p("tenantExist")),
          });
        })
        .httpError(404, () => {
          message.error({
            content: t(p("userNotFound")),
          });
        })
        .httpError(422, (e) => {
          if (e.code === "USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP") {
            message.error({
              content: t(p("userStillMaintainsAccountRelationship")),
            });
          }
          if (e.code === "USER_STILL_MAINTAINS_TENANT_ROLES") {
            message.error({
              content: t(p("userStillMaintainsTenantRoles")),
            });
          }
        })
        .then(() => {
          message.info({ content: t(p("addCompleted")) });
          form.resetFields();
        })
        .catch(() => {
          message.error({ content: t(p("createTenantFailMessage")) });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // 新建租户的租户管理员为新创建用户
      const result = await api.userExists({ body: { identityId: userId } });
      if (result.existsInScow) {
        modal.error({
          title: t(p("adminExist")),
          content: t(p("adminExistMessage")),
          okText: t("common.ok"),
          onOk: async () => {
            setLoading(false);
          },
        });
      } else if (!result.existsInAuth && result.existsInAuth !== undefined && !useBuiltinCreateUser()) {
        // 用户不不存在于scow,且认证系统支持查询，且查询结果不存在于认证系统，且当前系统不支持内置创建用户
        modal.confirm({
          title: t(p("adminNotExistAuth")),
          content: t(p("adminNotExistAuthMessage")),
          okText: t("common.ok"),
          onOk: async () => {
            setLoading(false);
          },
          onCancel: async () => {
            setLoading(false);
          },
        });
      } else {
        modal.confirm({
          title: t("common.prompt"),
          content:
            result.existsInAuth !== undefined
              ? // 认证系统支持查询
                result.existsInAuth
                ? t(p("adminExistAuthMessage"))
                : t(p("adminNotExistAuthAndConfirmCreateMessage"))
              : // 认证系统不支持查询
                useBuiltinCreateUser()
                ? t(p("unableConfirmAdminExistInAuthMessage"))
                : t(p("unableConfirmAdminExistInAuthAndUnableCreateMessage")),

          okText: t("common.ok"),
          onOk: async () => {
            await api
              .createTenant({
                body: {
                  tenantName: tenantName.trim(),
                  userId,
                  userName: userName.trim(),
                  userEmail,
                  userPassword,
                },
              })
              .httpError(409, (e) => {
                modal.error({
                  title: t("common.addFail"),
                  content: t(p("existInSCOWDatabase"), [
                    e.code === "TENANT_ALREADY_EXISTS" ? t("common.tenant") : t("common.user"),
                  ]),
                  okText: t("common.ok"),
                });
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
              .httpError(501, () => {
                message.error(t(p("unavailable")));
              })
              .then((createdInAuth) => {
                if (createdInAuth.createdInAuth) {
                  message.success(t(p("addCompleted")));
                } else {
                  modal.info({
                    title: t("common.addSuccess"),
                    content: t(p("createTenantSuccessMessage")),
                    okText: t("common.ok"),
                  });
                }
              })
              .catch(() => {
                modal.error({
                  title: t("common.addFail"),
                  content: t(p("createTenantFailMessage")),
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
    }
  };

  return (
    <Form
      form={form}
      wrapperCol={{ span: 20 }}
      labelCol={{ span: 4, style: { whiteSpace: "normal", textAlign: "left", lineHeight: "16px" } }}
      labelAlign="left"
      onFinish={onOk}
    >
      <CreateTenantForm />
      <Form.Item wrapperCol={{ span: 6, offset: 4 }}>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t("common.submit")}
        </Button>
      </Form.Item>
    </Form>
  );
};

export const CreateTenantPage: NextPage = requireAuth((i) => i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN))(
  () => {
    const t = useI18nTranslateToString();

    return (
      <div>
        <Head title={t(p("createTenant"))} />
        <PageTitle titleText={t(p("createTenant"))} />
        <FormLayout>
          <CreateTenantPageForm />
        </FormLayout>
      </div>
    );
  },
);

export default CreateTenantPage;
