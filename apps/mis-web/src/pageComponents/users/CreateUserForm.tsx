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

import { Form, Input } from "antd";
import React from "react";
import { publicConfig } from "src/utils/config";
import { confirmPasswordFormItemProps, emailRule, passwordRule } from "src/utils/form";

export interface CreateUserFormFields {
  identityId: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface Props {
  noPassword?: boolean;
}

export const CreateUserForm: React.FC<Props> = ({ noPassword }) => {

  const form = Form.useFormInstance<CreateUserFormFields>();

  return (
    <>
      <Form.Item
        label="用户ID"
        name="identityId"
        rules={[
          { required: true },
          ...(publicConfig.USERID_PATTERN ? [{
            pattern: new RegExp(publicConfig.USERID_PATTERN),
            message: publicConfig.USERID_PATTERN_MESSAGE }] : []),
        ]}

      >
        <Input placeholder={publicConfig.USERID_PATTERN_MESSAGE} />
      </Form.Item>
      <Form.Item label="用户姓名" name="name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item
        label="用户邮箱"
        name="email"
        rules={[{ required: true }, emailRule]}
      >
        <Input />
      </Form.Item>
      {
        noPassword ? undefined : (
          <>
            <Form.Item
              rules={[{ required: true }, passwordRule]}
              label="密码"
              name="password"
            >
              <Input.Password placeholder={passwordRule.message} />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              hasFeedback
              {...confirmPasswordFormItemProps(form, "password")}
            >
              <Input.Password />
            </Form.Item>
          </>
        )
      }
    </>
  );
};
