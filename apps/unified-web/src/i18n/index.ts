import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLanguageDefinition, isSupportedLanguage } from "src/i18n/languages";
import { resources, SupportedLanguage, supportedLanguages } from "src/i18n/resources";

const LANGUAGE_STORAGE_KEY = "scow-unified-language";

const normalizeLanguage = (language: string | null | undefined): SupportedLanguage => {
  const normalized = language?.toLowerCase().replace("-", "_");
  const languageId = normalized?.startsWith("zh") ? "zh_cn" : normalized?.split("_")[0];
  return languageId && isSupportedLanguage(languageId) ? languageId : "en";
};

const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
const initialLanguage = normalizeLanguage(storedLanguage ?? window.navigator.language);

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: ["en", "zh_cn"],
  supportedLngs: supportedLanguages,
  load: "currentOnly",
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  initAsync: false,
});

const persistLanguage = (language: string) => {
  const normalizedLanguage = normalizeLanguage(language);
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  document.cookie = `language=${normalizedLanguage}; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Lax`;
  document.documentElement.lang = getLanguageDefinition(normalizedLanguage).htmlLanguage;
};

persistLanguage(initialLanguage);
i18n.on("languageChanged", persistLanguage);

export { i18n };
