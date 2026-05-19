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
  en: libWebEn,
  zh_cn: libWebZhCn,
  es: libWebEs,
  fr: libWebFr,
  ja: libWebJa,
  ko: libWebKo,
  ru: libWebRu,
  pt: libWebPt,
  de: libWebDe,
};

export const getCurrentLangLibWebText = (languageId: string, key: LibWebTextsKeys): string | undefined => {
  const currentLibWebTexts = libWebLanguages[languageId];
  const value = currentLibWebTexts[key];

  if (value && typeof value === "string") {
    return value;
  } else {
    return undefined as any;
  }
};
