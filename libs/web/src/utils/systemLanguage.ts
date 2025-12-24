import { HEADER_ACCEPT_VALID_LANGUAGES,
  I18nStringType, SYSTEM_VALID_LANGUAGES, SystemLanguageConfig } from "@scow/config/build/i18n";
import type { IncomingMessage } from "http";
import { parseCookies } from "nookies";

export function getI18nConfigCurrentText(
  i18nConfigText: I18nStringType | undefined, languageId: string | undefined): string {
  if (!i18nConfigText) {
    return "";
  }
  if (typeof i18nConfigText === "string") {
    return i18nConfigText;
  }

  // 当语言id或者对应的配置文本中某种语言不存在时，显示default的值
  if (!languageId) {
    return i18nConfigText.i18n.default;
  }

  return i18nConfigText.i18n[languageId] || i18nConfigText.i18n.default;
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


/**
 * 根据当前语言获取带有插值变量的国际化文本
 * @param languageItem 国际化文本
 * @param placeholderValues 插值变量
 * @returns
 */
export const getCurrentLangTextArgs = (
  languageItem: string,
  placeholderValues: React.ReactNode[] | Record<string, React.ReactNode>,
): string | React.ReactNode | undefined => {

  // https://github.com/ddadaal/react-typed-i18n/
  let head = 0, index = 0;
  let valueArgs: React.ReactNode[] | undefined = undefined;
  const results = [] as React.ReactNode[];
  let escaped = false;
  let allString = true;
  const append = (text: string | React.ReactNode | undefined) => {

    if (typeof text !== "string") {
      results.push(text ?? "");
      allString = false;
      return;
    }

    if (results.length === 0) {
      results.push(text);
    } else {
      if (typeof results[results.length - 1] === "string") {
        (results[results.length - 1] as string) += text;
      } else {
        results.push(text);
      }
    }
  };
  while (head < languageItem.length) {
    if (languageItem[head] === "\\") {
      if (escaped) {
        append("\\");
        escaped = false;
      } else {
        escaped = true;
      }
      head++;
    } else if (languageItem[head] === "{") {
      if (escaped) {
        append("\\{");
        escaped = false;
        head++;
      } else {
        head++;
        if (head < languageItem.length) {
          let key = "";
          while (head < languageItem.length && languageItem[head] !== "}") {
            key += languageItem[head++];
          }
          if (head === languageItem.length) {
            append("{" + key);
            break;
          } else {
            head++;
            if (key === "") {
              if (!valueArgs) {
                valueArgs = Array.isArray(placeholderValues) ? placeholderValues : Object.values(placeholderValues);
              }
              append(valueArgs[index++]);
            } else {
              append(placeholderValues[key]);
            }
          }
        } else {
          append("{");
          break;
        }
      }
    } else {
      append(languageItem[head]);
      head++;
    }
  }

  return allString ? results.join("") : results;
};
