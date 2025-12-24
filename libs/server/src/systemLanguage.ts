import { HEADER_ACCEPT_VALID_LANGUAGES,
  I18nStringType, SYSTEM_VALID_LANGUAGES, SystemLanguageConfig } from "@scow/config/build/i18n";
import { IncomingMessage } from "http";
import { parseCookies } from "nookies";



export function getI18nConfigCurrentText(
  i18nConfigText: I18nStringType | undefined, languageId: string | undefined): string {
  if (!i18nConfigText) {
    return "";
  }
  if (typeof i18nConfigText === "string") {
    return i18nConfigText;
  } else {

    // 当语言id或者对应的配置文本中某种语言不存在时，显示default的值
    if (!languageId) return i18nConfigText.i18n.default;
    switch (languageId) {
      case SYSTEM_VALID_LANGUAGES.EN:
        return i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.ZH_CN:
        return i18nConfigText.i18n.zh_cn || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.JA:
        return i18nConfigText.i18n.ja || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.KO:
        return i18nConfigText.i18n.ko || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.FR:
        return i18nConfigText.i18n.fr || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.DE:
        return i18nConfigText.i18n.de || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.ES:
        return i18nConfigText.i18n.es || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.PT:
        return i18nConfigText.i18n.pt || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      case SYSTEM_VALID_LANGUAGES.RU:
        return i18nConfigText.i18n.ru || i18nConfigText.i18n.en || i18nConfigText.i18n.default;
      default:
        return i18nConfigText.i18n.default;
    }
  }
};

/**
 * 返回系统当前语言
 *
 * @param req
 * @param systemLanguageConfig
 * @returns
 */
export function getCurrentLanguageId(req: IncomingMessage | undefined,
  systemLanguageConfig: SystemLanguageConfig): string {
  // 如果系统不使用i18n，则直接使用defaultLanguage
  if (!systemLanguageConfig.isUsingI18n) {
    return systemLanguageConfig.defaultLanguage;
  }

  const cookies = parseCookies({ req });
  // 如果cookie设置了而且有效，就使用cookie
  if (cookies?.language) {
    const currentCookieLang = cookies.language;
    if (Object.values(SYSTEM_VALID_LANGUAGES).includes(currentCookieLang)) {
      return currentCookieLang;
    }
  }
  // 如果cookies不合法且autoDetectWhenUserNotSet为true则优先判断浏览器偏好
  if (systemLanguageConfig.autoDetectWhenUserNotSet) {
    const acceptLanguageHeader = req?.headers["accept-language"];
    if (acceptLanguageHeader) {
      const preferredLanguages = acceptLanguageHeader.split(",");
      if (preferredLanguages.length > 0) {
      // 遍历语言偏好列表
        for (const lang of preferredLanguages) {
          const preferredLanguage = lang.split(";")[0];
          // 判断偏好语言中的语言是否合法
          if (Object.values(HEADER_ACCEPT_VALID_LANGUAGES).includes(preferredLanguage)) {
            switch (preferredLanguage) {
              case HEADER_ACCEPT_VALID_LANGUAGES.ZH_CN:
              case HEADER_ACCEPT_VALID_LANGUAGES.ZH:
                return SYSTEM_VALID_LANGUAGES.ZH_CN;
              case HEADER_ACCEPT_VALID_LANGUAGES.EN_US:
              case HEADER_ACCEPT_VALID_LANGUAGES.EN:
                return SYSTEM_VALID_LANGUAGES.EN;
              case HEADER_ACCEPT_VALID_LANGUAGES.JA_JP:
              case HEADER_ACCEPT_VALID_LANGUAGES.JA:
                return SYSTEM_VALID_LANGUAGES.JA;
              case HEADER_ACCEPT_VALID_LANGUAGES.KO_KR:
              case HEADER_ACCEPT_VALID_LANGUAGES.KO:
                return SYSTEM_VALID_LANGUAGES.KO;
              case HEADER_ACCEPT_VALID_LANGUAGES.FR_FR:
              case HEADER_ACCEPT_VALID_LANGUAGES.FR:
                return SYSTEM_VALID_LANGUAGES.FR;
              case HEADER_ACCEPT_VALID_LANGUAGES.DE_DE:
              case HEADER_ACCEPT_VALID_LANGUAGES.DE:
                return SYSTEM_VALID_LANGUAGES.DE;
              case HEADER_ACCEPT_VALID_LANGUAGES.ES_ES:
              case HEADER_ACCEPT_VALID_LANGUAGES.ES:
                return SYSTEM_VALID_LANGUAGES.ES;
              case HEADER_ACCEPT_VALID_LANGUAGES.PT_PT:
              case HEADER_ACCEPT_VALID_LANGUAGES.PT:
                return SYSTEM_VALID_LANGUAGES.PT;
              case HEADER_ACCEPT_VALID_LANGUAGES.RU_RU:
              case HEADER_ACCEPT_VALID_LANGUAGES.RU:
                return SYSTEM_VALID_LANGUAGES.RU;
              default:
                break;
            }
          }
        }
      }
    }
  }
  // 如果判断不出，或者autoDetectWhenUserNotSet为false则直接使用默认语言
  return systemLanguageConfig.defaultLanguage;
};

