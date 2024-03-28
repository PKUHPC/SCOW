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

import { FormInstance } from "antd";
import { RuleObject } from "antd/es/form";

import { getCurrentLangLibWebText } from "./libWebI18n/libI18n";


export const confirmPasswordFormItemProps = <
  PasswordFieldName extends string,
  T extends { [key in PasswordFieldName]: string }
>(form: FormInstance<T>, passwordFieldName: PasswordFieldName, languageId: string) => {
  return {
    dependencies: [passwordFieldName],
    validateFirst: true,
    rules: [
      {
        required: true,
        message: getCurrentLangLibWebText(languageId, "confirmPasswordMessage"),
      },
      {
        validator: async (_, value) => {
          if (value && form.getFieldValue(passwordFieldName) !== value) {
            throw new Error(getCurrentLangLibWebText(languageId, "confirmPasswordNotEqualError"));
          }
        },
      },
    ],
  };
};

export const getEmailRule = (languageId: string) => ({
  type: "email",
  message: getCurrentLangLibWebText(languageId, "confirmPasswordEmailError"),
}) as const;


// 正数校验
export const positiveNumberRule = (_: RuleObject, value: any, languageId: string) => {

  if ((value && parseFloat(value) < 0) || value === 0) {
    const errorMessage = getCurrentLangLibWebText(languageId, "notPositiveNumberError");
    return Promise.reject(errorMessage);
  }
  return Promise.resolve();
};

// 用户限额大于等于已用额度校验
export const compareUsedChargeRule =
  (_: RuleObject, value: any, usedCharge: number | undefined, languageId: string) => {

    if (usedCharge && value < usedCharge) {
      const errorMessage = getCurrentLangLibWebText(languageId, "compareUsedChargeError");
      return Promise.reject(errorMessage);
    }
    return Promise.resolve();
  };
