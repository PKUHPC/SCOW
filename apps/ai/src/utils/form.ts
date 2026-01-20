import { RuleObject } from "antd/lib/form/index";

export { confirmPasswordFormItemProps, getEmailRule } from "@scow/lib-web/build/utils/form";

export const noWhiteSpaceRule = {
  type: "string" as const,
  required: true,
  whitespace: true,
};

export const createNoChineseValidator = (
  message?: string,
) => () => ({
  validator(_: RuleObject, value: string) {
  // 使用正则表达式验证是否包含中文字符
    if (/[\u4e00-\u9fa5]/.test(value)) {
      return Promise.reject(message ?? "不能包含中文字符");
    }
    return Promise.resolve();
  },
});

export const createResourceNameValidator = (message?: string) => () => ({
  validator(_: RuleObject, value: string) {
    // 校验长度（按字节长度计算）且不能包含 `/`
    // 数据库中分享路径由资源名称、版本名称和文件系统中的文件夹名组成等
    // 比如：/nfs/.shared/demo_admin2/algorithm/${资源名称}/${版本名称}/${文件系统中的文件夹名}
    // 经验值:长度 < 255/4
    const encoder = new TextEncoder();
    if (encoder.encode(value).length > 50 || value.includes("/")) {
      return Promise.reject(message ?? "长度不能超过 50 字节且不能包含 '/' 字符");
    }
    return Promise.resolve();
  },
});

export const createK8sNameValidator = (message?: string) => () => ({
  validator(_: RuleObject, value: string) {
    if (!value) {
      return Promise.resolve();
    }


    // - 如果长度=1：必须是字母或数字
    // - 如果长度>=2：开头必须是字母，结尾必须是字母或数字，中间允许字母/数字/-
    const regex = /^([a-z]|[a-z0-9][a-z0-9-]{0,38}[a-z0-9])$/;

    if (!regex.test(value)) {
      return Promise.reject(
        message ??
          "必须是1-40个小写字母、数字或'-'，并且以字母开头和结尾必须是字母或数字",
      );
    }

    return Promise.resolve();
  },
});

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
