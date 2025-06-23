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

import { createI18n, Lang, languageDictionary, TextIdFromLangDict } from "react-typed-i18n";


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
