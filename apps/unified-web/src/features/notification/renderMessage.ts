import type { JsonObject, JsonValue } from "@bufbuild/protobuf";
import type { Template } from "@scow/notification-protos/build/common_pb";
import type { Message } from "@scow/notification-protos/build/message_pb";
import type { NotificationMessage } from "src/features/notification/types";

type TemplateLanguageField = "default" | "en" | "zhCn" | "de" | "es" | "fr" | "ja" | "ko" | "pt" | "ru";

const languageTemplateFields: Record<string, TemplateLanguageField> = {
  zh_cn: "zhCn",
  en: "en",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  es: "es",
  pt: "pt",
  ru: "ru",
};

const metadataFieldTranslations: Record<
  string,
  Record<string, Partial<Record<TemplateLanguageField, string>> & { default: string }>
> = {
  messageStatus: {
    Completed: { default: "完成", en: "COMPLETED", zhCn: "完成" },
    Exception: { default: "异常", en: "EXCEPTION", zhCn: "异常" },
  },
};

const getTemplateLanguageField = (language: string): TemplateLanguageField =>
  languageTemplateFields[language] ?? "default";

const getTemplateText = (template: Template | undefined, language: string) => {
  if (!template) return "";
  const field = getTemplateLanguageField(language);
  const localized = template[field];
  return typeof localized === "string" && localized ? localized : template.default;
};

const isJsonObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => part.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
};

const getMetadataValue = (
  field: string,
  value: JsonValue | undefined,
  language: string,
): string | undefined => {
  if (value === undefined || value === null) return undefined;

  if (field === "time" && typeof value === "string") return formatDateTime(value);

  const templateField = getTemplateLanguageField(language);
  const fieldTranslation = metadataFieldTranslations[field]?.[String(value)];
  if (fieldTranslation) return fieldTranslation[templateField] ?? fieldTranslation.default;

  if (isJsonObject(value) && isJsonObject(value.i18n)) {
    const localized = value.i18n[language] ?? value.i18n[templateField] ?? value.i18n.default;
    if (typeof localized === "string") return localized;
  }

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
};

const replaceTemplate = (template: string, metadata: JsonObject, language: string) =>
  template.replace(/\{__(.*?)__\}/g, (placeholder, field: string) => {
    const value = getMetadataValue(field, metadata[field], language);
    return value === undefined ? placeholder : value;
  });

export const renderNotificationMessage = (message: Message, language: string): NotificationMessage => {
  const metadata = message.metadata ?? {};
  const directTitle = metadata.title;
  const directContent = metadata.content;
  const messageType = message.messageType?.type || "";
  const isSystemNotification = messageType === "SystemNotification";
  const titleTemplate = getTemplateText(message.messageType?.titleTemplate, language);
  const contentTemplate = getTemplateText(message.messageType?.contentTemplate, language);
  const fallbackContent = message.descriptions.find((description) => description.length > 0) ?? "";

  return {
    id: message.id.toString(),
    messageType,
    title:
      isSystemNotification && typeof directTitle === "string" ? directTitle : titleTemplate || messageType || "-",
    content:
      isSystemNotification && typeof directContent === "string"
        ? directContent
        : contentTemplate
          ? replaceTemplate(contentTemplate, metadata, language)
          : typeof directContent === "string"
            ? directContent
            : fallbackContent,
    category: message.messageType?.category || "Other",
    isRead: message.isRead ?? false,
    createdAt: message.createdAt,
  };
};

export const getLocalizedTemplate = (template: Template | undefined, language: string) =>
  getTemplateText(template, language);
