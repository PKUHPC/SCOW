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

import { Alert, Divider, Form, Input, Radio } from "antd";
import React from "react";
import { prefix, useI18n, useI18nTranslateToString } from "src/i18n";
import { getUserIdRule, useBuiltinCreateUser } from "src/utils/createUser";
import { confirmPasswordFormItemProps, getEmailRule, passwordRule } from "src/utils/form";

export enum UserType {
  New = "new",
  Existing = "existing",
}

export interface CreateTenantFormFields {
  tenantName: string;
  userType: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPassword: string;
  userConfirmPassword: string;
}

const p = prefix("pageComp.admin.createTenantForm.");
const pCommon = prefix("common.");

export const CreateTenantForm: React.FC = () => {

  const t = useI18nTranslateToString();

  const form = Form.useFormInstance<CreateTenantFormFields>();

  const languageId = useI18n().currentLanguage.id;
  const userIdRule = getUserIdRule(languageId);

  const userType = Form.useWatch("userType", form);


  return (
    <>
      <Divider
        style={{ marginTop: 0 }}
        orientation="left"
        orientationMargin="0"
        plain
      >{t(p("prompt"))}</Divider>
      <Form.Item
        label={t(pCommon("tenantFullName"))}
        name="tenantName"
        rules={[
          { required: true },
          { max: 255 },
        ]}
      >
        <Input />
      </Form.Item>
      <Divider orientation="left" orientationMargin="0" plain>{t(p("adminInfo"))}</Divider>
      <Form.Item
        label={t(p("userType"))}
        name="userType"
        initialValue={UserType.New}
        rules={[
          { required: true },
        ]}
        required
      >
        <Radio.Group onChange={() => {}}>
          <Radio value={UserType.New}>{t(p("newUser"))}</Radio>
          <Radio value={UserType.Existing}>{t(p("existingUser"))}</Radio>
        </Radio.Group>
      </Form.Item>
      {userType === UserType.New && (
        <Alert
          style={{ marginBottom: 10 }}
          banner
          message={t(p("createTenantByNewUserWarningInfo"))}
          type="warning"
          showIcon
        />
      )}
      {userType === UserType.Existing && (
        <Alert
          style={{ marginBottom: 10 }}
          banner
          message={t(p("createTenantByExistUserWarningInfo"))}
          type="warning"
          showIcon
        />
      )}
      <Form.Item
        label={t(pCommon("userId"))}
        name="userId"
        rules={[
          { required: true },
          ...userIdRule ? [userIdRule] : [],
        ]}
      >
        <Input placeholder={userIdRule?.message} />
      </Form.Item>
      <Form.Item label={t(pCommon("userFullName"))} name="userName" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      { userType === UserType.New && (
        <>
          <Form.Item
            label={t(p("userEmail"))}
            name="userEmail"
            rules={[{ required: true }, getEmailRule(languageId)]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label={t(p("userPassword"))}
            name="userPassword"
            rules={[{ required: true }, passwordRule(languageId)]}
          >
            <Input.Password placeholder={passwordRule(languageId).message} />
          </Form.Item>
          {
            useBuiltinCreateUser() ? (
              <>
                <Form.Item
                  label={t(p("confirmPassword"))}
                  name="confirmPassword"
                  hasFeedback
                  {...confirmPasswordFormItemProps(form, "userPassword", languageId)}
                >
                  <Input.Password placeholder={passwordRule(languageId).message} />
                </Form.Item>
              </>
            ) : undefined
          }
        </>
      )}
    </>
  );
};
