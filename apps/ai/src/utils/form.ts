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

import { RuleObject } from "antd/lib/form/index.js";

export { confirmPasswordFormItemProps, getEmailRule } from "@scow/lib-web/build/utils/form";

export const noWhiteSpaceRule = {
  type: "string" as const,
  required: true,
  whitespace: true,
};

export const validateNoChinese = (_: RuleObject, value: any) => {
  // 使用正则表达式验证是否包含中文字符
  if (/[\u4e00-\u9fa5]/.test(value)) {
    return Promise.reject("不能包含中文字符");
  }
  return Promise.resolve();
};


export const imageNameValidation = (_: RuleObject, value: any) => {
  // 由字母（小写）、数字、"_"、"-"和"."组成，不能以符号开始或结束， 小于128字符
  if (/^[a-z0-9]([a-z0-9_\-.]{0,126}[a-z0-9])?$/.test(value)) {
    return Promise.resolve();

  }
  return Promise.reject("由字母（小写）、数字、\"_\"、\"-\"和\".\"组成，不能以符号开始或结束"); ;
};

export const imageTagValidation = (_: RuleObject, value: any) => {
  // 由字母、数字、"_"、"-"和"."组成，不能以符号开始或结束， 小于128字符
  if (/^[a-zA-Z0-9]([a-zA-Z0-9_\-.]{0,126}[a-zA-Z0-9])?$/.test(value)) {
    return Promise.resolve();

  }
  return Promise.reject("由字母、数字、\"_\"、\"-\"和\".\"组成，不能以符号开始或结束"); ;
};


export const createInterdependentValidator = <T>(
  dependentField: keyof T,
  message: string = "",
) => ({ getFieldValue }: { getFieldValue: (name: keyof T) => any }) => ({
  validator(_: RuleObject, value: string) {
    if (!value && getFieldValue(dependentField)) {
      return Promise.reject(new Error(message));
    }
    return Promise.resolve();
  },
});

export const inputNumberFloorConfig = {
  formatter: (value: number | undefined) => `${Math.floor(value ?? 0)}`,
  parser: (value: string | undefined) => Math.floor(value ? +value : 0),
};
