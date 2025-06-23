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

import { SYSTEM_VALID_LANGUAGES } from "@scow/config/build/i18n";
import { I18nObject } from "@scow/protos/build/common/i18n";
import { createI18n,
  getDefinition, Lang, languageDictionary, replacePlaceholders, TextIdFromLangDict } from "react-typed-i18n";

const zh_cn = () => import("./zh_cn").then((x) => x.default);
const en = () => import("./en").then((x) => x.default);

// return language type
export type LangType = Awaited<ReturnType<typeof zh_cn>>;

export const languages = languageDictionary({
  zh_cn,
  en,
});

export const languageInfo = {
  zh_cn: { name: "CN 中" },
  en: { name: "EN 英" },
};

// eslint-disable-next-line @typescript-eslint/unbound-method
export const { Localized, Provider, id, prefix, useI18n } = createI18n(languages);

export type TextId = TextIdFromLangDict<typeof languages>;

export function useI18nTranslate() {
  const i18n = useI18n();

  const tArgs = (id: Lang<LangType>, args: React.ReactNode[] = []): string | React.ReactNode => {
    return i18n.translate(id, args);
  };

  return tArgs;
}

export function useI18nTranslateToString() {
  const i18n = useI18n();

  const t = (id: Lang<LangType>, args: React.ReactNode[] = []): string => {
    return i18n.translateToString(id, args);
  };

  return t;
}

export type TransType = (id: Lang<typeof en>, args?: React.ReactNode[]) => string;

export async function getT(languageId: string) {
  const definitions = await languages[languageId]();
  return (id: Lang<LangType>, args: React.ReactNode[] = []): string => {
    return replacePlaceholders(getDefinition(definitions, id), args) as string;
  };
};

export async function getTArgs(languageId: string) {
  const definitions = await languages[languageId]();
  return (id: Lang<LangType>, args: React.ReactNode[] = []): string | React.ReactNode => {
    return replacePlaceholders(getDefinition(definitions, id), args);
  };
};

export function getI18nCurrentText(
  i18nObject: I18nObject | undefined, languageId: string | undefined): string {
  if (!i18nObject?.i18n) {
    return "";
  }
  // 当语言id或者对应的配置文本中某种语言不存在时，显示default的值
  if (!languageId) return i18nObject.i18n.default;
  switch (languageId) {
    case SYSTEM_VALID_LANGUAGES.EN:
      return i18nObject.i18n.en || i18nObject.i18n.default;
    case SYSTEM_VALID_LANGUAGES.ZH_CN:
      return i18nObject.i18n.zhCn || i18nObject.i18n.default;
    default:
      return i18nObject.i18n.default;
  }
};
