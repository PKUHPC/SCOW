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

import { Alert, App, Button, Form, Typography } from "antd";
import { useState } from "react";
import { api } from "src/apis";
import { Centered } from "src/components/layouts";
import { prefix, useI18nTranslateToString } from "src/i18n";
import { CreateUserForm, CreateUserFormFields } from "src/pageComponents/users/CreateUserForm";
import { useBuiltinCreateUser } from "src/utils/createUser";
import { styled } from "styled-components";


type FormFields = Omit<CreateUserFormFields, "confirmPassword">;

const AlertContainer = styled.div`
  margin-bottom: 16px;
`;

const p = prefix("pageComp.init.initAdminForm.");
const pCommon = prefix("common.");

export const InitAdminForm: React.FC = () => {

  const t = useI18nTranslateToString();

  const [form] = Form.useForm<FormFields>();

  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(false);
  const onFinish = async () => {
    const { email, identityId, name, password } = await form.validateFields();
    setLoading(true);
    const result = await api.userExists({ body: { identityId } });
    if (result.existsInScow) {
      // 如果在scow中已经存在这个用户，则不用创建操作
      modal.error({
        title: t(p("alreadyExist")),
        content:t(p("cannotAdd")),
        okText: t(pCommon("ok")),
        onOk: async () => {
          setLoading(false);
        },
      });
    } else if (!result.existsInAuth && result.existsInAuth !== undefined && !useBuiltinCreateUser()) {
      // 用户不存在于scow: 且认证系统支持查询，且查询结果不存在于认证系统，且当前系统不支持创建用户
      modal.confirm({
        title: t(p("notExist")),
        content: t(p("confirm")),
        okText: t(pCommon("ok")),
        onOk: async () => {
          setLoading(false);
        },
        onCancel: async () => {
          setLoading(false);
        },
      });
    } else {
      // 其他情况：
      // 情况1.用户不存在于scow && 认证系统支持查询 && 存在于认证系统 ->数据库创建
      // 情况2：用户不存在于scow && 认证系统支持查询 &&不存在于认证系统 && 系统支持创建用户 -> 认证系统创建用户->数据库创建
      // 情况1与2合并为：用户不存在于scow && 认证系统支持查询 &&(存在于认证系统 || (不存在于认证系统 && 系统支持创建用户))
      // 情况3.用户不存在于scow && 认证系统不支持查询->判断认证系统是否支持创建用户 ->数据库创建->尝试->认证系统创建
      // result.existsInAuth ? "此用户存在于已经认证系统，确认添加为初始管理员？" : "用户不存在，是否确认创建此用户并添加为初始管理员？",
      modal.confirm({
        title: t(pCommon("prompt")),
        content: result.existsInAuth !== undefined ?
          // 认证系统支持查询
          result.existsInAuth ?
            t(p("existText")) : t(p("notExistText"))
          : // 认证系统不支持查询
          useBuiltinCreateUser() ? t(p("cannotConfirmText1")) : t(p("cannotConfirmText2")),
        okText: t(pCommon("ok")),
        onCancel: () => {
          setLoading(false);
        },
        onOk: async () => {
          await api.createInitAdmin(
            { body: { email, identityId, name: name.trim(), password } })
            .httpError(409, (e) => {
              if (e.code === "ALREADY_EXISTS_IN_SCOW")
                modal.error({
                  title: t(p("addFail")),
                  content: t(p("userExist")),
                  okText: t(pCommon("ok")),
                });
            })
            .then((createdInAuth) => {
              if (createdInAuth.createdInAuth) {
                message.success(t(p("addFinish")));
              } else {
                modal.info({
                  title: t(p("addSuccess")),
                  content: t(p("addDb")),
                  okText: t(pCommon("ok")),
                });
              }
            })
            .catch(() => {
              modal.error({
                title:  t(p("addFail")),
                content:t(p("createFail")),
              });
            })
            .finally(() => {
              form.resetFields();
              setLoading(false);
            });
        },
      });
    }

  };
  return (
    <div>
      <Typography.Paragraph>{t(p("initAdmin"))}</Typography.Paragraph>
      <Typography.Paragraph>
        {t(p("addAdmin"))}<span>{t(p("platFormAdmin"))}</span>{t(p("and"))}
        <span>{t(p("defaultTenant"))}</span>{t(pCommon("role"))}。
      </Typography.Paragraph>
      <AlertContainer>
        <Alert
          type={useBuiltinCreateUser() ? "success" : "warning"}
          message={useBuiltinCreateUser() ? t(p("createText1")) : t(p("createText2"))
          }
        />
      </AlertContainer>
      <Form form={form} onFinish={onFinish}>
        <CreateUserForm />
        <Centered>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t(pCommon("add"))}
            </Button>
          </Form.Item>
        </Centered>
      </Form>
    </div>
  );
};
