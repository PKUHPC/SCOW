/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { IncomingMessage } from "http";
import { parseCookies } from "nookies";

// 当前系统支持的header中可接受语言
export const HEADER_ACCEPT_VALID_LANGUAGES = {
  ZH: "zh",
  ZH_CN: "zh_cn",
  EN: "en",
  EN_US: "en-US",
};

// 系统支持语言列表
export const SYSTEM_VALID_LANGUAGES = {
  ZH_CN: "zh_cn",
  EN: "en",
};

// 系统默认语言：简体中文
export const SYSTEM_DEFAULT_LANGUAGE = "zh_cn";

export function getLanguageCookie(req: IncomingMessage | undefined): string {

  // 检查 Cookie 中的语言是否合法
  const cookies = parseCookies({ req });

  if (cookies && cookies.language) {
    const currentCookeiLang = cookies.language;
    if (Object.values(SYSTEM_VALID_LANGUAGES).includes(currentCookeiLang)) {
      return currentCookeiLang;
    }
  }

  // 如果 Cookie 不合法或不存在，尝试从请求头中获取语言偏好
  const acceptLanguageHeader = req?.headers["accept-language"];
  if (acceptLanguageHeader) {

    const preferredLanguages = acceptLanguageHeader.split(",");
    if (preferredLanguages.length > 0) {
      // 遍历语言偏好列表
      for (const preferredLanguage of preferredLanguages) {
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

  // 系统默认语言
  return SYSTEM_DEFAULT_LANGUAGE;
}

