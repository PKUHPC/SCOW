import { createI18n, Lang, languageDictionary, TextIdFromLangDict } from "react-typed-i18n";

const zh_cn = () => import("./zh_cn").then((x) => x.default);
const en = () => import("./en").then((x) => x.default);
const ja = () => import("./ja").then((x) => x.default);
const ko = () => import("./ko").then((x) => x.default);
const fr = () => import("./fr").then((x) => x.default);
const de = () => import("./de").then((x) => x.default);
const es = () => import("./es").then((x) => x.default);
const pt = () => import("./pt").then((x) => x.default);
const ru = () => import("./ru").then((x) => x.default);

// return language type
type LangType = Awaited<ReturnType<typeof zh_cn>>;

export const languages = languageDictionary({
  zh_cn, en,
});

export const languageInfo = {
  zh_cn: { name: "CN 中" },
  en: { name: "EN 英" },
  ja: { name: "JA 日" },
  ko: { name: "KO 韩" },
  fr: { name: "FR 法" },
  de: { name: "DE 德" },
  es: { name: "ES 西" },
  pt: { name: "PT 葡" },
  ru: { name: "RU 俄" },
};

// eslint-disable-next-line @typescript-eslint/unbound-method
export const { Localized, Provider, id, prefix, useI18n, loadLanguageDefinitions } = createI18n(languages, {
  fallbackLanguageId: "en",
  languages: { ja, ko, fr, de, es, pt, ru },
});

export type TextId = TextIdFromLangDict<typeof languages>;

export function useI18nTranslate() {
  const i18n = useI18n();

  const tArgs = (id: Lang<LangType>, args: React.ReactNode[] = []): string | React.ReactNode => {
    return i18n.translate(id, args);
  };

  return tArgs;
}

export function useI18nTranslateToString() {
  const i18n = useI18n();

  const t = (id: Lang<LangType>, args: React.ReactNode[] = []): string => {
    return i18n.translateToString(id, args);
  };

  return t;
}

export type TransType = ReturnType<typeof useI18nTranslateToString>;
