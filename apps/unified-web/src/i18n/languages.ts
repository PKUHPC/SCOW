import deDE from "antd/locale/de_DE";
import enUS from "antd/locale/en_US";
import esES from "antd/locale/es_ES";
import frFR from "antd/locale/fr_FR";
import jaJP from "antd/locale/ja_JP";
import koKR from "antd/locale/ko_KR";
import ptPT from "antd/locale/pt_PT";
import ruRU from "antd/locale/ru_RU";
import zhCN from "antd/locale/zh_CN";
import type { Locale } from "antd/es/locale";
import type { SupportedLanguage } from "src/i18n/resources";

type Translate = (key: string, defaultValue: string) => string;

export const languageDefinitions: {
  id: SupportedLanguage;
  htmlLanguage: string;
  label: (translate: Translate) => string;
  antdLocale: Locale;
}[] = [
  { id: "zh_cn", htmlLanguage: "zh-CN", label: (translate) => translate("language.zhCn", "CN 中"), antdLocale: zhCN },
  { id: "en", htmlLanguage: "en", label: (translate) => translate("language.en", "EN 英"), antdLocale: enUS },
  { id: "ja", htmlLanguage: "ja", label: (translate) => translate("language.ja", "JA 日"), antdLocale: jaJP },
  { id: "ko", htmlLanguage: "ko", label: (translate) => translate("language.ko", "KO 韩"), antdLocale: koKR },
  { id: "fr", htmlLanguage: "fr", label: (translate) => translate("language.fr", "FR 法"), antdLocale: frFR },
  { id: "de", htmlLanguage: "de", label: (translate) => translate("language.de", "DE 德"), antdLocale: deDE },
  { id: "es", htmlLanguage: "es", label: (translate) => translate("language.es", "ES 西"), antdLocale: esES },
  { id: "pt", htmlLanguage: "pt", label: (translate) => translate("language.pt", "PT 葡"), antdLocale: ptPT },
  { id: "ru", htmlLanguage: "ru", label: (translate) => translate("language.ru", "RU 俄"), antdLocale: ruRU },
];

export const isSupportedLanguage = (language: string): language is SupportedLanguage =>
  languageDefinitions.some(({ id }) => id === language);

export const getLanguageDefinition = (language: string | undefined) =>
  languageDefinitions.find(({ id }) => id === language) ?? languageDefinitions[0];
