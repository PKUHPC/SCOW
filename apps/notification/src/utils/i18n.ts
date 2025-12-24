import { deepMerge } from "react-typed-i18n";
import { I18nDicType, languageDic, optionalLanguageDic } from "src/models/i18n";

const fallbackLanguage = languageDic.en;

export const getLanguage = (languageId: string | undefined | null): I18nDicType => {

  if (!languageId) {
    languageId = "zh_cn";
  }

  // 先看是不是optionalLanguages
  const optionalLanguage = optionalLanguageDic[languageId];

  if (optionalLanguage) {
    return deepMerge(fallbackLanguage, optionalLanguage);
  }

  const norm = languageId.toLowerCase().replace(/-/g, "_");
  const base = norm.startsWith("zh") ? "zh_cn" : norm.split("_")[0];
  const lang = (base in languageDic)
    ? languageDic[base as keyof typeof languageDic]
    : languageDic.zh_cn;

  return lang;
};

export type I18nDicKeys = keyof I18nDicType;
