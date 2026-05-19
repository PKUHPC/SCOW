import { DeepPartial } from "react-typed-i18n";

import libWebDe from "./libWebDe";
import libWebEn from "./libWebEn";
import libWebEs from "./libWebEs";
import libWebFr from "./libWebFr";
import libWebJa from "./libWebJa";
import libWebKo from "./libWebKo";
import libWebPt from "./libWebPt";
import libWebRu from "./libWebRu";
import libWebZhCn from "./libWebZhCn";

export type LibWebTextsType = typeof libWebEn;
export type LibWebTextsKeys = keyof LibWebTextsType;

export const libWebLanguages: Record<string, LibWebTextsType> = {
  zh_cn: libWebZhCn,
  en: libWebEn,
};

export const optionalLanguages: Record<string, DeepPartial<LibWebTextsType>> = {
  de: libWebDe,
  es: libWebEs,
  fr: libWebFr,
  ja: libWebJa,
  ko: libWebKo,
  pt: libWebPt,
  ru: libWebRu,
};

export const getCurrentLangLibWebText = (languageId: string, key: LibWebTextsKeys): string | undefined => {
  return optionalLanguages[languageId]?.[key] ?? libWebLanguages[languageId]?.[key];
};
