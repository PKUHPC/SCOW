import type { UnifiedUiConfig } from "src/api/uiConfig";

export const mockUiConfig: UnifiedUiConfig = {
  userToken: "mock-user-token",
  primaryColor: {
    defaultColor: "#1677ff",
    darkModeColor: "#1668dc",
  },
  darkMode: false,
  brandingApiBase: "/api/unified/portal",
  titleTag: "Unified Preview",
  initialLanguage: "zh_cn",
  systemLanguageConfig: {
    defaultLanguage: "zh_cn",
    isUsingI18n: true,
    autoDetectWhenUserNotSet: true,
    enabledLanguages: ["zh_cn", "en", "ja", "ko", "fr", "de", "es", "pt", "ru"],
  },
};
