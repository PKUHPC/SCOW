import profileDe from "src/i18n/locales/de/profile.json";
import aiEn from "src/i18n/locales/en/ai.json";
import commonEn from "src/i18n/locales/en/common.json";
import dashboardEn from "src/i18n/locales/en/dashboard.json";
import notificationEn from "src/i18n/locales/en/notification.json";
import portalEn from "src/i18n/locales/en/portal.json";
import profileEn from "src/i18n/locales/en/profile.json";
import quantumEn from "src/i18n/locales/en/quantum.json";
import profileEs from "src/i18n/locales/es/profile.json";
import profileFr from "src/i18n/locales/fr/profile.json";
import profileJa from "src/i18n/locales/ja/profile.json";
import profileKo from "src/i18n/locales/ko/profile.json";
import profilePt from "src/i18n/locales/pt/profile.json";
import profileRu from "src/i18n/locales/ru/profile.json";
import aiZhCn from "src/i18n/locales/zh_cn/ai.json";
import commonZhCn from "src/i18n/locales/zh_cn/common.json";
import dashboardZhCn from "src/i18n/locales/zh_cn/dashboard.json";
import notificationZhCn from "src/i18n/locales/zh_cn/notification.json";
import portalZhCn from "src/i18n/locales/zh_cn/portal.json";
import profileZhCn from "src/i18n/locales/zh_cn/profile.json";
import quantumZhCn from "src/i18n/locales/zh_cn/quantum.json";

export const supportedLanguages = ["zh_cn", "en", "ja", "ko", "fr", "de", "es", "pt", "ru"] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const resources = {
  zh_cn: {
    common: commonZhCn,
    portal: portalZhCn,
    ai: aiZhCn,
    dashboard: dashboardZhCn,
    notification: notificationZhCn,
    profile: profileZhCn,
    quantum: quantumZhCn,
  },
  en: {
    common: commonEn,
    portal: portalEn,
    ai: aiEn,
    dashboard: dashboardEn,
    notification: notificationEn,
    profile: profileEn,
    quantum: quantumEn,
  },
  ja: { common: {}, profile: profileJa },
  ko: { common: {}, profile: profileKo },
  fr: { common: {}, profile: profileFr },
  de: { common: {}, profile: profileDe },
  es: { common: {}, profile: profileEs },
  pt: { common: {}, profile: profilePt },
  ru: { common: {}, profile: profileRu },
} as const;
