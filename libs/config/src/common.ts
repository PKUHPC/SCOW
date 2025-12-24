import { GetConfigFn, getConfigFromFile } from "@scow/lib-config";
import { Static, Type } from "@sinclair/typebox";

import { DEFAULT_CONFIG_BASE_PATH } from "./constants";
import { createI18nStringSchema, SYSTEM_VALID_LANGUAGE_ENUM, SystemLanguage, SystemLanguageConfig } from "./i18n";

export const NotificationConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否开启消息系统", default: false }),
  name: Type.String({ description: "消息系统名称，和 ui 扩展名称保持一致", default: "notification" }),
  address: Type.String({ description: "消息系统地址", default: "http://notification:3000" }),
});

export const ScowApiConfigSchema = Type.Object({
  auth: Type.Optional(Type.Object({
    token: Type.Optional(Type.String({ description: "允许使用Token认证，token的值" })),
  }, { description: "SCOW API认证配置" })),
});

export const ScowHookConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否启用SCOW Hook", default: true }),
  url: Type.Optional(Type.String({ description: "SCOW Hook的URL" })),
  hooks: Type.Optional(Type.Array(Type.Object({
    name: Type.Optional(Type.String({ description: "Hook的名称" })),
    url: Type.String({ description: "Hook的URL" }),
  }), { description: "多个Hook的URL。SCOW将会以数组的顺序逐个调用各个hook。" })),
}, { description: "SCOW Hook配置" });

export const ScowResourceConfigSchema = Type.Object({
  enabled: Type.Boolean({ description: "是否启用资源管理", default: false }),
  address: Type.String({ description: "资源管理", default: "scow-resource:3000" }),
});

export const CommonConfigSchema = Type.Object({
  passwordPattern: Type.Object({
    regex: Type.String({
      description: "用户密码的正则规则",
      default: "^(?=.*\\d)(?=.*[a-zA-Z])(?=.*[`~!@#\\$%^&*()_+\\-[\\];',./{}|:\"<>?]).{8,}$",
    }),
    errorMessage: createI18nStringSchema({
      description: "如果密码不符合规则显示什么",
      defaultValue: "必须包含字母、数字和符号，长度大于等于8位",
    }),

  }, { description: "创建用户、修改密码时的密码的规则" }),

  scowHook: Type.Optional(ScowHookConfigSchema),
  scowApi: Type.Optional(ScowApiConfigSchema),
  userLinks: Type.Optional(Type.Array(
    Type.Object({
      text: Type.String({ description: "链接名称" }),
      url: Type.String({ description: "链接地址" }),
      openInNewPage: Type.Optional(Type.Boolean({ description:"一级导航是否默认在新页面打开", default: false })),
    }),
  )),

  systemLanguage: Type.Optional(Type.Union([
    Type.Object({
      autoDetectWhenUserNotSet: Type.Optional(Type.Boolean({ description: "是否跟随系统进行语言选择" })),
      default: Type.Optional(Type.Enum(SYSTEM_VALID_LANGUAGE_ENUM, { description: "系统默认语言" })),
      enabledLanguages: Type.Optional(Type.Array(Type.Enum(SYSTEM_VALID_LANGUAGE_ENUM), {
        description: "系统可切换的语言列表",
      })),
    }, {
      description: "允许手动切换SCOW支持的合法语言，可以指定系统默认语言" }),
    Type.Enum(SYSTEM_VALID_LANGUAGE_ENUM, { description: "SCOW使用的文本语言，不再允许手动切换" }),
  ], { description: "", default: {
    autoDetectWhenUserNotSet: true,
    default: SYSTEM_VALID_LANGUAGE_ENUM.zh_cn,
  } })),

  scowResource: Type.Optional(ScowResourceConfigSchema),

  notification: Type.Optional(NotificationConfigSchema),

  allowAppAuthorization: Type.Boolean({ description: "开启授权交互式应用功能", default: true }),

  // 仪表盘配置
  dashboard: Type.Optional(Type.Object({
  // 该配置项仅对普通用户生效，平台管理员和租户管理员不受影响，始终以 full 模式展示。
  // 可选值：
  //   - full: 完整模式，显示所有资源数据。
  //   - simplified: 简化模式，只显示可用节点总数、运行中的数量等基本信息。
    userDisplayMode:
      Type.Union([
        Type.Literal("full", { description: "完整模式" }),
        Type.Literal("simplified", { description: "简化模式" }),
      ]),
  })),
});

export const getSystemLanguageConfig = (systemLanguage: SystemLanguage): SystemLanguageConfig => {

  if (typeof systemLanguage === "string") {
    return {
      defaultLanguage: systemLanguage,
      isUsingI18n: false,
      autoDetectWhenUserNotSet: false,
      enabledLanguages: [systemLanguage],
    };
  }
  return {
    defaultLanguage: systemLanguage?.default ?? SYSTEM_VALID_LANGUAGE_ENUM.zh_cn,
    isUsingI18n: true,
    autoDetectWhenUserNotSet: systemLanguage?.autoDetectWhenUserNotSet ?? true,
    enabledLanguages: systemLanguage?.enabledLanguages ?? ["zh_cn", "en"],
  };
};


const COMMON_CONFIG_NAME = "common";

export type ScowHookConfigSchema = Static<typeof ScowHookConfigSchema>;
export type ScowApiConfigSchema = Static<typeof ScowApiConfigSchema>;
export type ScowResourceConfigSchema = Static<typeof ScowResourceConfigSchema>;

export type CommonConfigSchema = Static<typeof CommonConfigSchema>;

export const getCommonConfig: GetConfigFn<CommonConfigSchema> = (baseConfigPath) =>
  getConfigFromFile(CommonConfigSchema, COMMON_CONFIG_NAME, baseConfigPath ?? DEFAULT_CONFIG_BASE_PATH);
