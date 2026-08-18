import type { LocalizedText } from "src/features/dashboard/types";

type DirectLocalizedText = Partial<
  Record<"default" | "zhCn" | "en" | "ja" | "ko" | "fr" | "de" | "es" | "pt" | "ru", string>
>;

const languageFields: Record<string, keyof DirectLocalizedText> = {
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

export const getLocalizedText = (text: LocalizedText, language: string) => {
  if (typeof text === "string") return text;
  if ("i18n" in text) return text.i18n[language] || text.i18n.default;
  const directText = text as DirectLocalizedText;
  return directText[languageFields[language] ?? "default"] || directText.default || directText.zhCn || directText.en || "";
};

export const toQuickEntryClusterName = (text: LocalizedText) => {
  if (typeof text === "string" || "i18n" in text) return text;
  return {
    i18n: {
      default: text.default || text.zhCn || text.en || "",
      zh_cn: text.zhCn,
      en: text.en,
      ja: text.ja,
      ko: text.ko,
      fr: text.fr,
      de: text.de,
      es: text.es,
      pt: text.pt,
      ru: text.ru,
    },
  };
};

export const compareWithUndefined = <T extends number | string>(
  first: T | undefined,
  second: T | undefined,
  sortOrder?: "ascend" | "descend" | null,
) => {
  if (first === undefined) return sortOrder === "descend" ? -1 : 1;
  if (second === undefined) return sortOrder === "descend" ? 1 : -1;
  return first < second ? -1 : first > second ? 1 : 0;
};
