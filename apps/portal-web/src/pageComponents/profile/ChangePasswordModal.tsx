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

import { App, Form, Input, Modal } from "antd";
import React, { useState } from "react";
import { api } from "src/apis";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getRuntimeI18nConfigText } from "src/utils/config";
import { confirmPasswordFormItemProps, passwordRule } from "src/utils/form";

export interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormInfo {
  oldPassword: string;
  newPassword: string;
}


export const ChangePasswordModal: React.FC<Props> = ({
  open,
  onClose,
}) => {

  const [form] = Form.useForm<FormInfo>();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const languageId = useI18n().currentLanguage.id;

  const t = useI18nTranslateToString();
  const p = prefix("pageComp.profile.changPasswordModal.");

  const onFinish = async () => {
    const { oldPassword, newPassword } = await form.validateFields();
    setLoading(true);
    api.checkPassword({ query: { password: oldPassword } })
      .httpError(404, () => {
        message.error("用户不存在");
      })
      .httpError(501, () => {
        message.error("本功能在当前配置下不可用");
      })
      .then((result) => {
        if (result.success) {
          return api.changePassword({ body: { newPassword } })
            .httpError(400, (e) => {
              if (e.code === "PASSWORD_NOT_VALID") {
                message.error(getRuntimeI18nConfigText(languageId, "passwordPatternMessage"));
              };
            })
            .httpError(404, () => {
              message.error("用户不存在");
            })
            .httpError(501, () => {
              message.error("本功能在当前配置下不可用");
            })
            .then(() => {
              form.resetFields();
              message.success(t(p("successMessage")));
            });
        }
        else {
          message.error(t(p("errorMessage")));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Modal
      title={t(p("changePassword"))}
      open={open}
      onOk={form.submit}
      confirmLoading={loading}
      onCancel={onClose}
      destroyOnClose
    >
      <Form
        form={form}
        onFinish={onFinish}
        wrapperCol={{ span: 20 }}
        labelCol={{ span:4, style: { whiteSpace:"normal", textAlign:"left", lineHeight:"16px" } }}

      >
        <Form.Item
          rules={[{ required: true }]}
          label={t(p("oldPassword"))}
          name="oldPassword"
        >
          <Input.Password />
        </Form.Item>
        <Form.Item
          rules={[{ required: true }, passwordRule(languageId)]}
          label={t(p("newPassword"))}
          name="newPassword"
        >
          <Input.Password placeholder={passwordRule(languageId).message} />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={t(p("confirm"))}
          hasFeedback
          {...confirmPasswordFormItemProps(form, "newPassword", languageId)}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
  );
};


