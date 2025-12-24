import { createI18n, languageDictionary } from "react-typed-i18n";

const zh_cn = () => import("./zh_cn").then((x) => x.default);
const en = () => import("./en").then((x) => x.default);
const fr = () => import("./fr").then((x) => x.default);
const de = () => import("./de").then((x) => x.default);
const es = () => import("./es").then((x) => x.default);
const pt = () => import("./pt").then((x) => x.default);
const ru = () => import("./ru").then((x) => x.default);
const ja = () => import("./ja").then((x) => x.default);
const ko = () => import("./ko").then((x) => x.default);

// return language type
export type AuthTextsType = Awaited<ReturnType<typeof zh_cn>>;

const languages = languageDictionary({
  zh_cn,
  en,
});

export const { loadLanguageDefinitions } = createI18n(languages, {
  fallbackLanguageId: "zh_cn",
  languages: { fr, de, es, pt, ru, ja, ko },
});

