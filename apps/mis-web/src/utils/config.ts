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

import { AuditConfigSchema } from "@scow/config/build/audit";
import type { ClusterTextsConfigSchema } from "@scow/config/build/clusterTexts";
import { I18nStringType, SystemLanguageConfig } from "@scow/config/build/i18n";
import type { MisConfigSchema } from "@scow/config/build/mis";
import type { UiConfigSchema } from "@scow/config/build/ui";
import { UiExtensionConfigSchema } from "@scow/config/build/uiExtensions";
import { UserLink } from "@scow/lib-web/build/layouts/base/types";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";
import getConfig from "next/config";

export interface ServerRuntimeConfig {
  AUTH_EXTERNAL_URL: string;
  AUTH_INTERNAL_URL: string;

  SERVER_URL: string;

  UI_CONFIG: UiConfigSchema | undefined;
  DEFAULT_PRIMARY_COLOR: string;

  CLUSTER_TEXTS_CONFIG: ClusterTextsConfigSchema;

  SCOW_API_AUTH_TOKEN?: string;

  AUDIT_CONFIG: AuditConfigSchema | undefined;

  SERVER_I18N_CONFIG_TEXTS: {
  };

  PROTOCOL: string;
}

export interface PublicRuntimeConfig {
  BASE_PATH: string;

  PREDEFINED_CHARGING_TYPES: string[];
  CREATE_USER_CONFIG: {
    misConfig: MisConfigSchema["createUser"],
    authSupportsCreateUser: boolean | undefined,
  },

  ADD_USER_TO_ACCOUNT: {
    accountAdmin: {
      allowed: boolean,
      createUserIfNotExist: boolean,
    }
  }
  ENABLE_CHANGE_PASSWORD: boolean | undefined;

  ACCOUNT_NAME_PATTERN: string | undefined;

  PASSWORD_PATTERN: string | undefined;

  PORTAL_URL: string | undefined;

  AI_URL: string | undefined;

  PUBLIC_PATH: string;

  NAV_LINKS?: NavLink[];

  CUSTOM_AMOUNT_STRATEGIES?: CustomAmountStrategy[];

  USER_LINKS?: UserLink[];

  VERSION_TAG: string | undefined;

  AUDIT_DEPLOYED: boolean;

  RUNTIME_I18N_CONFIG_TEXTS: {
    passwordPatternMessage: I18nStringType | undefined,
    accountNamePatternMessage: I18nStringType | undefined,
    createUserBuiltinErrorMessage: I18nStringType | undefined,
    createUserErrorMessage: I18nStringType | undefined,

  }

  CHARGE_TYPE_LIST: string[];

  SYSTEM_LANGUAGE_CONFIG: SystemLanguageConfig;

  CLUSTER_MONITOR: {
    grafanaUrl: string | undefined,
    resourceStatus: {
      enabled: boolean | undefined,
      proxy: boolean | undefined,
      dashboardUid: string | undefined,
    },
    alarmLogs: { enabled: boolean | undefined }
  },

  ASYNC_OPERATION: {
    enabled: boolean | undefined,
    asyncHub: {
      address: string | undefined,
    }
  },

  UI_EXTENSION?: UiExtensionConfigSchema;

  CHANGE_JOB_LIMIT: { allowUser: boolean }

  JOB_CHARGE_METADATA: jobChargeMetadataType;

}

export const runtimeConfig: ServerRuntimeConfig = getConfig().serverRuntimeConfig;
export const publicConfig: PublicRuntimeConfig = getConfig().publicRuntimeConfig;

export interface NavLink {
  text: string;
  url?: string;
  openInNewPage?: boolean;
  iconPath?: string;
  allowedRoles?: string[];
  children?: (Omit<NavLink, "children" | "url"> & { url: string })[];
};

export interface CustomAmountStrategy {
  id: string;
  script: string;
  name?: string | undefined;
  comment?: string | undefined;
};

type ServerI18nConfigKeys = keyof typeof runtimeConfig.SERVER_I18N_CONFIG_TEXTS;
// 获取ServerConfig中相关字符串配置的对应语言的字符串
export const getServerI18nConfigText = <TKey extends ServerI18nConfigKeys>(
  languageId: string,
  key: TKey,
) => {
  return getI18nText(runtimeConfig.SERVER_I18N_CONFIG_TEXTS, key, languageId);
};

type RuntimeI18nConfigKeys = keyof typeof publicConfig.RUNTIME_I18N_CONFIG_TEXTS;
// 获取RuntimeConfig中相关字符串配置的对应语言的字符串
export const getRuntimeI18nConfigText = <TKey extends RuntimeI18nConfigKeys>(
  languageId: string,
  key: TKey,
) => {
  return getI18nText(publicConfig.RUNTIME_I18N_CONFIG_TEXTS, key, languageId);
};

/**
 *
 * 当具有嵌套结构的obj中有实现i18n需求的文字时，用此方法。
 * 因为没有经过是否一定具有i18n类型的校验，只当嵌套类型中出现I18nStringType时采用此方法。
 * @param obj
 * 如果是多层嵌套，传递最终实现i18n文本的外层obj
 * @param key
 * 获取最终对应i18n文本字段的key
 * @param languageId
 * 当前语言id
 * @returns string | undefined
 * i18n语言文本
 */
export const getI18nText = <TObject extends object, TKey extends keyof TObject>(
  obj: TObject | undefined, key: TKey, languageId: string,
): (TObject[TKey] extends I18nStringType ? string : (string | undefined)) => {

  if (!obj) { return undefined as any; }
  const value = obj[key];

  if (!value) { return undefined as any; }

  return getI18nConfigCurrentText(value as any, languageId);
};

export type jobChargeMetadataType = MisConfigSchema["jobChargeMetadata"];
