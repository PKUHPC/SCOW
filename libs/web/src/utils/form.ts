import { FormInstance } from "antd";
import { RuleObject } from "antd/es/form";
import {
  DEFAULT_FORBIDDEN_CONTAINER_PATHS,
  PathValidationMessages,
  validateContainerMountTargetPath,
  validateHomeScopedPath,
  validateLinuxAbsolutePath,
  validateRelativeToHomePath,
  validateSafePath,
} from "@scow/utils";

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

/** 统一创建 Ant Design validator 需要的 rejected Promise。 */
const rejectPath = (message: string) => Promise.reject(new Error(message));

/**
 * 创建基础路径安全校验规则。
 *
 * 允许：
 * - 绝对路径，例如 "/data/project"；
 * - 相对路径，例如 "project/output"；
 * - 根目录 "/"。
 *
 * 禁止：
 * - 空格、tab、换行、控制字符；
 * - , ; | & > < ` $ " ' \ * ? [ ] { } ( )；
 * - 任意路径段为 ".."。
 *
 * 不校验：
 * - 是否必须以 "/" 开头；
 * - 是否位于用户家目录下；
 * - 是否为系统目录。
 */
export const createSafePathValidator =
  (messages: PathValidationMessages = {}) =>
  () => ({
    validator(_: RuleObject, value: unknown) {
      const error = validateSafePath(value, messages);
      return error ? rejectPath(error) : Promise.resolve();
    },
  });

/**
 * 创建 Linux 绝对路径校验规则，适用于必须以 "/" 开头的路径输入。
 *
 * 允许：
 * - 绝对路径，例如 "/data/project"。
 *
 * 禁止：
 * - 相对路径，例如 "project/output"；
 * - 空格、tab、换行、控制字符；
 * - , ; | & > < ` $ " ' \ * ? [ ] { } ( )；
 * - 任意路径段为 ".."；
 * - 任意路径段为 "."；
 * - 默认禁止根目录 "/"，传入 options.rootAllowed = true 时允许。
 *
 * 不校验：
 * - 是否位于用户家目录下；
 * - 是否为系统目录。
 */
export const createLinuxAbsolutePathValidator =
  (messages: PathValidationMessages = {}, options: { rootAllowed?: boolean } = {}) =>
  () => ({
    validator(_: RuleObject, value: unknown) {
      const error = validateLinuxAbsolutePath(value, messages, options);
      return error ? rejectPath(error) : Promise.resolve();
    },
  });

/**
 * 创建“相对用户家目录解析”的路径校验规则。
 *
 * 允许：
 * - 相对路径，例如 "project/output"；
 * - 位于 homeDir 或 additionalRootPaths 下的绝对路径。
 *
 * 禁止：
 * - 空格、tab、换行、控制字符；
 * - , ; | & > < ` $ " ' \ * ? [ ] { } ( )；
 * - 任意路径段为 ".."；
 * - 任意路径段为 "."。
 * - 绝对路径不在 homeDir 或 additionalRootPaths 下；
 * - homeDir 和 additionalRootPaths 均为空时的绝对路径。
 *
 * 不校验：
 * - 是否必须以 "/" 开头；
 * - 是否已经被转换为 "$HOME/xxx"；
 * - 相对路径最终拼接后的路径是否真实存在或可写。
 */
export const createRelativeToHomePathValidator =
  (homeDir: string | undefined, messages: PathValidationMessages = {}, additionalRootPaths: string[] = []) =>
  () => ({
    validator(_: RuleObject, value: unknown) {
      const error = validateRelativeToHomePath(value, homeDir, messages, additionalRootPaths);
      return error ? rejectPath(error) : Promise.resolve();
    },
  });

/**
 * 创建用户家目录或可信根目录范围内的绝对路径校验规则，适用于 WORK_DIR、挂载源等用户文件路径。
 *
 * 允许：
 * - 等于 homeDir 的绝对路径，例如 homeDir 为 "/home/alice" 时允许 "/home/alice"；
 * - 位于 homeDir 下的绝对路径，例如 "/home/alice/project"。
 * - 位于 additionalRootPaths 下的绝对路径。
 *
 * 禁止：
 * - 相对路径，例如 "project/output"；
 * - 空格、tab、换行、控制字符；
 * - , ; | & > < ` $ " ' \ * ? [ ] { } ( )；
 * - 任意路径段为 ".."；
 * - 任意路径段为 "."；
 * - homeDir 和 additionalRootPaths 均为空时的非空路径；
 * - 不在 homeDir 或 additionalRootPaths 下的路径。
 *
 * 不校验：
 * - 路径是否真实存在；
 * - 当前用户是否有读写权限；
 * - 是否为符号链接。
 */
export const createHomeScopedPathValidator =
  (homeDir: string | undefined, messages: PathValidationMessages = {}, additionalRootPaths: string[] = []) =>
  () => ({
    validator(_: RuleObject, value: unknown) {
      const error = validateHomeScopedPath(value, homeDir, messages, additionalRootPaths);
      return error ? rejectPath(error) : Promise.resolve();
    },
  });

/**
 * 创建容器挂载目标路径校验规则，适用于容器内 mount target。
 *
 * 允许：
 * - 非根目录的绝对路径，例如 "/mnt/data"、"/workspace/project"。
 *
 * 禁止：
 * - 相对路径，例如 "mnt/data"；
 * - 根目录 "/"；
 * - 空格、tab、换行、控制字符；
 * - , ; | & > < ` $ " ' \ * ? [ ] { } ( )；
 * - 任意路径段为 ".."；
 * - 任意路径段为 "."；
 * - forbiddenPaths 中的目录及其子目录。
 *
 * 默认 forbiddenPaths：
 * - /bin、/boot、/dev、/etc、/lib、/lib64、/proc、/root、/run、/sbin、/sys、/usr、/var。
 *
 * 不校验：
 * - 路径是否真实存在；
 * - 容器内最终是否可写。
 */
export const createContainerMountTargetPathValidator =
  (messages: PathValidationMessages = {}, forbiddenPaths: string[] = DEFAULT_FORBIDDEN_CONTAINER_PATHS) =>
  () => ({
    validator(_: RuleObject, value: unknown) {
      const error = validateContainerMountTargetPath(value, messages, forbiddenPaths);
      return error ? rejectPath(error) : Promise.resolve();
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
