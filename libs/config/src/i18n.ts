import { Type } from "@sinclair/typebox";

import { CommonConfigSchema } from "./common";

// 创建配置文件中支持国际化文本文字项的配置类型
export const createI18nStringSchema = ({
  description,
  defaultValue,
}: {
  description: string;
  defaultValue?: string;
}) => {
  return Type.Union(
    [
      Type.String(),
      Type.Object({
        i18n: Type.Object({
          default: Type.String({ description: "国际化类型默认值" }),
          en: Type.Optional(Type.String({ description: "国际化类型英文值" })),
          zh_cn: Type.Optional(Type.String({ description: "国际化类型简体中文值" })),
          ja: Type.Optional(Type.String({ description: "国际化类型日文值" })),
          ko: Type.Optional(Type.String({ description: "国际化类型韩文值" })),
          fr: Type.Optional(Type.String({ description: "国际化类型法文值" })),
          de: Type.Optional(Type.String({ description: "国际化类型德文值" })),
          es: Type.Optional(Type.String({ description: "国际化类型西班牙文值" })),
          pt: Type.Optional(Type.String({ description: "国际化类型葡萄牙文值" })),
          ru: Type.Optional(Type.String({ description: "国际化类型俄文值" })),
        }),
      }),
    ],
    { description, default: defaultValue },
  );
};

// 当前系统支持的header中可接受语言
export const HEADER_ACCEPT_VALID_LANGUAGES = {
  ZH: "zh",
  ZH_CN: "zh-CN",
  EN: "en",
  EN_US: "en-US",
  JA: "ja",
  JA_JP: "ja-JP",
  KO: "ko",
  KO_KR: "ko-KR",
  FR: "fr",
  FR_FR: "fr-FR",
  DE: "de",
  DE_DE: "de-DE",
  ES: "es",
  ES_ES: "es-ES",
  PT: "pt",
  PT_PT: "pt-PT",
  RU: "ru",
  RU_RU: "ru-RU",
};

// 系统支持语言列表
export const SYSTEM_VALID_LANGUAGES = {
  ZH_CN: "zh_cn",
  EN: "en",
  JA: "ja",
  KO: "ko",
  FR: "fr",
  DE: "de",
  ES: "es",
  PT: "pt",
  RU: "ru",
};

// 系统合法语言枚举值
export enum SYSTEM_VALID_LANGUAGE_ENUM {
  "zh_cn" = "zh_cn",
  "en" = "en",
  "ja" = "ja",
  "ko" = "ko",
  "fr" = "fr",
  "de" = "de",
  "es" = "es",
  "pt" = "pt",
  "ru" = "ru",
}

export type SystemLanguage = CommonConfigSchema["systemLanguage"];

export interface SystemLanguageConfig {
  defaultLanguage: string;
  isUsingI18n: boolean;
  autoDetectWhenUserNotSet: boolean;
  enabledLanguages: string[];
}

// 配置项文本国际化类型
export type I18nStringType =
  | string
  | {
      i18n: {
        default: string;
        en?: string;
        zh_cn?: string;
        ja?: string;
        ko?: string;
        fr?: string;
        de?: string;
        es?: string;
        pt?: string;
        ru?: string;
      };
    };

export type I18nObjectType = Exclude<I18nStringType, string>;

export interface I18nObject {
  i18n?: I18nObject_I18n | undefined;
}

export interface I18nObject_I18n {
  default: string;
  en?: string | undefined;
  zhCn?: string | undefined;
  ja?: string | undefined;
  ko?: string | undefined;
  fr?: string | undefined;
  de?: string | undefined;
  es?: string | undefined;
  pt?: string | undefined;
  ru?: string | undefined;
}
