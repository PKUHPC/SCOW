import { I18nObjectType } from "@scow/config/build/i18n";
import {
  AdminMessageType,
  adminMessageTypesMap,
  CONTENT_FIELD_I18N_MAP,
  CustomMessageType,
  Template,
} from "src/models/notification";

import { formatDateTime } from "./datetime";
import { AnyJson } from "./type";

export interface RenderContent {
  id: number;
  title: string;
  description: string;
  createdAt: string;
}

enum TemplateLang {
  default = "default",
  en = "en",
  zhCn = "zhCn",
  de = "de",
  es = "es",
  ja = "ja",
  ko = "ko",
  fr = "fr",
  pt = "pt",
  ru = "ru",
}

export interface Message {
  id: number;
  messageType?: {
    type: string;
    titleTemplate?: Template;
    contentTemplate?: Template;
    category: string;
    categoryTemplate?: Template;
  };
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export const checkAdminMessageTypeExist = (type: string): CustomMessageType | undefined => {
  if (adminMessageTypesMap.has(type as AdminMessageType)) {
    return { type, ...adminMessageTypesMap.get(type as AdminMessageType) } as CustomMessageType;
  }

  return undefined;
};

export function replaceTemplate(metadata: AnyJson, template: string, templateLang?: TemplateLang): string {
  if (!metadata) return "";

  return template.replace(/\{__(.*?)__\}/g, (match, p1) => {
    const fieldValue = metadata[p1];
    let value: string;
    if (p1 === "time") {
      value = formatDateTime(metadata[p1] as string);
      // 检查是否是需要国际化的字段
    } else if (CONTENT_FIELD_I18N_MAP[p1] && templateLang) {
      const rawValue = metadata[p1] as string;
      const i18nTemplate = CONTENT_FIELD_I18N_MAP[p1][rawValue];
      if (i18nTemplate) {
        // 根据语言获取对应翻译，如果没有则使用 default
        value = i18nTemplate[templateLang] || i18nTemplate.default;
      } else {
        // 如果配置中没有这个值，直接使用原值
        value = rawValue;
      }
    } else if (isI18nObject(fieldValue) && templateLang) {
      const tempLangFiledValue = convertI18nStringToTemplate(fieldValue);
      // 根据语言获取对应翻译，如果没有则使用 default
      value = tempLangFiledValue[templateLang] || tempLangFiledValue.default;
    } else {
      // 普通字段，直接取值
      value = metadata[p1] as string;
    }

    return value !== undefined ? value : match;
  });
}

function checkTemplateNotUndefined(message: Message) {
  if (message.messageType?.titleTemplate === undefined) return false;
  if (message.messageType.categoryTemplate === undefined) return false;
  if (message.messageType.contentTemplate === undefined) return false;

  return true;
}

function parseAdminMessage(message: Message): RenderContent | undefined {
  const fields = message.metadata;

  if (!fields) return undefined;

  return {
    id: message.id,
    // eslint-disable-next-line @typescript-eslint/dot-notation
    title: fields["title"],
    // eslint-disable-next-line @typescript-eslint/dot-notation
    description: fields["content"] as string,
    createdAt: formatDateTime(message.createdAt),
  };
}

export const renderingMessage = (message: Message, languageId: string): RenderContent | undefined => {
  if (!message.messageType || !message.metadata) return undefined;

  if (checkAdminMessageTypeExist(message.messageType.type)) {
    return parseAdminMessage(message);
  } else if (checkTemplateNotUndefined(message)) {
    let templateLang: TemplateLang = TemplateLang.default;
    const map: Record<string, TemplateLang> = {
      en: TemplateLang.en,
      zh_cn: TemplateLang.zhCn,
      de: TemplateLang.de,
      es: TemplateLang.es,
      fr: TemplateLang.fr,
      ja: TemplateLang.ja,
      ko: TemplateLang.ko,
      pt: TemplateLang.pt,
      ru: TemplateLang.ru,
    };
    templateLang = map[languageId] ?? TemplateLang.default;

    // 对应语言模板没有设置时采用默认模板
    const messageType = message.messageType;
    const titleTemplate = messageType.titleTemplate?.[templateLang] || messageType.titleTemplate!.default;
    const contentTemplate = messageType.contentTemplate?.[templateLang] || messageType.contentTemplate!.default;

    return {
      id: message.id,
      title: titleTemplate,
      description: replaceTemplate(message.metadata, contentTemplate, templateLang),
      createdAt: formatDateTime(message.createdAt),
    };
  } else {
    return {
      id: message.id,
      title: message.messageType.type,
      description: message.metadata?.content,
      createdAt: formatDateTime(message.createdAt),
    };
  }
};

// 判断是否为 I18nObjectType 的对象格式
export function isI18nObject(value: unknown): value is I18nObjectType {
  if (typeof value !== "object" || value === null || !("i18n" in value)) {
    return false;
  }

  const { i18n } = value as { i18n: unknown };

  if (typeof i18n !== "object" || i18n === null || !("default" in i18n)) {
    return false;
  }

  const i18nObj = i18n as Record<string, unknown>;

  // 检查 default 必须是 string
  if (typeof i18nObj.default !== "string") {
    return false;
  }

  // 检查可选字段（存在时必须是 string）
  const hasInvalidEn = "en" in i18nObj && i18nObj.en !== undefined && typeof i18nObj.en !== "string";
  const hasInvalidZhCn = "zh_cn" in i18nObj && i18nObj.zh_cn !== undefined && typeof i18nObj.zh_cn !== "string";

  return !hasInvalidEn && !hasInvalidZhCn;
}

// 将 I18nObjectType 转换为 Template 类型
export function convertI18nStringToTemplate(input: I18nObjectType): Template {
  const { default: defaultText, en, zh_cn } = input.i18n;

  return {
    default: defaultText,
    en: en ?? defaultText,
    zhCn: zh_cn ?? defaultText,
  };
}
