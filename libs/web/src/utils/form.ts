import { FormInstance } from "antd";
import { RuleObject } from "antd/es/form";

import { getCurrentLangLibWebText } from "./libWebI18n/libI18n";

export const confirmPasswordFormItemProps = <
  PasswordFieldName extends string,
  T extends { [key in PasswordFieldName]: string },
>(
  form: FormInstance<T>,
  passwordFieldName: PasswordFieldName,
  languageId: string,
) => {
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

export const getEmailRule = (languageId: string) =>
  ({
    type: "email",
    message: getCurrentLangLibWebText(languageId, "confirmPasswordEmailError"),
  }) as const;

// 正数校验
export const positiveNumberRule = (_: RuleObject, value: any, languageId: string) => {
  if ((value && parseFloat(value) < 0) || value === 0) {
    const errorMessage = getCurrentLangLibWebText(languageId, "notPositiveNumberError");
    return Promise.reject(new Error(errorMessage));
  }
  return Promise.resolve();
};

// 用户限额大于等于已用额度校验
export const compareUsedChargeRule = (
  _: RuleObject,
  value: any,
  usedCharge: number | undefined,
  languageId: string,
) => {
  if (usedCharge && value < usedCharge) {
    const errorMessage = getCurrentLangLibWebText(languageId, "compareUsedChargeError");
    return Promise.reject(new Error(errorMessage));
  }
  return Promise.resolve();
};

// check consistency of the compared value and the input value
export const validateDataConsistency = <InputFieldName extends string>(
  inputFieldName: InputFieldName,
  comparedValue: string,
  languageId: string,
) => {
  return {
    dependencies: [inputFieldName],
    validateFirst: true,
    rules: [
      {
        required: true,
        message: getCurrentLangLibWebText(languageId, "validateDataConsistencyMessage"),
      },
      {
        validator: async (_, value: string) => {
          if (value && comparedValue && comparedValue !== value) {
            throw new Error(getCurrentLangLibWebText(languageId, "validateDataConsistencyError"));
          }
        },
      },
    ],
  };
};

/**
 * 验证非空，不直接使用antd的require: true
 * 是因为封装的 InlineFormItem 中出现require: true是会显示红色星号
 * 有情况不需要红色星号
 */
export const createNonEmptyValidator = (message?: string) => () => ({
  validator(_: RuleObject, value: string) {
    if (!value) {
      return Promise.reject(new Error(message ?? "不能为空"));
    }
    return Promise.resolve();
  },
});

export const createK8sNameValidator = (message?: string) => () => ({
  validator(_: RuleObject, value: string) {
    if (!value) {
      return Promise.resolve();
    }

    // - 如果长度=1：必须是字母
    // - 如果长度>=2：开头必须是字母，结尾必须是字母或数字，中间允许字母/数字/-
    const regex = /^[a-z]([a-z0-9-]{0,38}[a-z0-9])?$/;

    if (!regex.test(value)) {
      return Promise.reject(
        new Error(message ?? "必须是1-40个小写字母、数字或'-'，并且以字母开头和结尾必须是字母或数字"),
      );
    }

    return Promise.resolve();
  },
});

export type MaxRunningTimeUnit = "MINUTE" | "HOUR" | "DAY" | "min" | "hour" | "day" | 0 | 1 | 2;

export function convertDurationToHours(value: number, unit: MaxRunningTimeUnit): number {
  switch (unit) {
    case "DAY":
    case "day":
    case 2:
      return value * 24;
    case "HOUR":
    case "hour":
    case 1:
      return value;
    case "MINUTE":
    case "min":
    case 0:
    default:
      return value / 60;
  }
}

// 前端校验是否超出已配置的最长运行时间
export function validateConfigMaxJobRunningHours(
  exceedMessage: string,
  positiveMessage: string,
  maxTimeUnit: MaxRunningTimeUnit,
  maxRunningTimeHours: number | undefined,
) {
  return (_: unknown, value: number) => {
    if (value <= 0) {
      return Promise.reject(new Error(positiveMessage));
    }
    if (maxRunningTimeHours !== undefined) {
      const valueInHours = convertDurationToHours(value, maxTimeUnit);
      if (valueInHours > maxRunningTimeHours) {
        return Promise.reject(new Error(exceedMessage));
      }
    }
    return Promise.resolve();
  };
}
