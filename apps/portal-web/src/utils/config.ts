import { AuditConfigSchema } from "@scow/config/build/audit";
import { ScowResourceConfigSchema } from "@scow/config/build/common";
import { I18nStringType, SystemLanguageConfig } from "@scow/config/build/i18n";
import type { PortalConfigSchema } from "@scow/config/build/portal";
import { PublicStorageConfigSchema } from "@scow/config/build/storage";
import type { UiConfigSchema } from "@scow/config/build/ui";
import { UiExtensionConfigSchema } from "@scow/config/build/uiExtensions";
import { UserLink } from "@scow/lib-web/build/layouts/base/types";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";

export interface ServerRuntimeConfig {
  AUTH_EXTERNAL_URL: string;

  AUTH_INTERNAL_URL: string;

  UI_CONFIG?: UiConfigSchema;

  PORTAL_CONFIG: PortalConfigSchema;

  DEFAULT_PRIMARY_COLOR: string;

  MOCK_USER_ID: string | undefined;

  SERVER_URL: string;

  SUBMIT_JOB_WORKING_DIR: string;

  SCOW_API_AUTH_TOKEN: string;

  AUDIT_CONFIG: AuditConfigSchema;

  SERVER_I18N_CONFIG_TEXTS: {
    submitJopPromptText?: I18nStringType;
  };

  PROTOCOL: string;

  SCOW_RESOURCE_CONFIG: ScowResourceConfigSchema;
}

export interface PublicRuntimeConfig {
  ENABLE_CHANGE_PASSWORD: boolean | undefined;

  ENABLE_SHELL: boolean;

  ENABLE_JOB_MANAGEMENT: boolean;

  ENABLE_APPS: boolean;

  MIS_URL: string;

  MIS_SERVER_URL: string;

  AI_URL: string | undefined;

  QUANTUM_URL: string | undefined;

  NOVNC_CLIENT_URL: string;

  PASSWORD_PATTERN: string | undefined;

  BASE_PATH: string;

  FILE_EDIT_SIZE: string | undefined;
  NON_EDITABLE_FILENAME_POSTFIXES: string[] | undefined;
  FILE_PREVIEW_SIZE: string | undefined;
  EXECUTABLE_FILENAME_POSTFIXES: string[] | undefined;

  PUBLIC_PATH: string;

  NAV_LINKS?: NavLink[];

  USER_LINKS?: UserLink[];

  VERSION_TAG: string | undefined;

  RUNTIME_I18N_CONFIG_TEXTS: {
    passwordPatternMessage: I18nStringType | undefined;
  };

  SYSTEM_LANGUAGE_CONFIG: SystemLanguageConfig;

  UI_EXTENSION?: UiExtensionConfigSchema;
  UI_CONFIG: UiConfigSchema | undefined;

  NOTIF_ADDRESS: string;
  NOTIF_NAME: string;

  SHADOW_DESK_ENABLED?: boolean;

  SHADOW_DESK_WMS?: string[];

  DASHBOARD_USER_DISPLAY_MODE: "full" | "simplified";

  PUBLIC_STORAGE_CONFIG?: PublicStorageConfigSchema;
}

interface RuntimeConfigs {
  serverRuntimeConfig: ServerRuntimeConfig;
  publicRuntimeConfig: PublicRuntimeConfig;
}

const configs = (
  globalThis as typeof globalThis & {
    __SCOW_RUNTIME_CONFIG__?: RuntimeConfigs;
  }
).__SCOW_RUNTIME_CONFIG__;

export const runtimeConfig = (configs?.serverRuntimeConfig ?? {}) as ServerRuntimeConfig;
export const publicConfig = (configs?.publicRuntimeConfig ?? {}) as PublicRuntimeConfig;

export interface NavLink {
  text: string;
  url?: string;
  openInNewPage?: boolean;
  iconPath?: string;
  clickable?: boolean;
  children?: (Omit<NavLink, "children" | "url"> & { url: string })[];
}

type ServerI18nConfigKeys = keyof typeof runtimeConfig.SERVER_I18N_CONFIG_TEXTS;
// 获取ServerConfig中相关字符串配置的对应语言的字符串
export const getServerI18nConfigText = <TKey extends ServerI18nConfigKeys>(languageId: string, key: TKey) => {
  return getI18nText(runtimeConfig.SERVER_I18N_CONFIG_TEXTS, key, languageId);
};

type RuntimeI18nConfigKeys = keyof typeof publicConfig.RUNTIME_I18N_CONFIG_TEXTS;
// 获取RuntimeConfig中相关字符串配置的对应语言的字符串
export const getRuntimeI18nConfigText = <TKey extends RuntimeI18nConfigKeys>(languageId: string, key: TKey) => {
  return getI18nText(publicConfig.RUNTIME_I18N_CONFIG_TEXTS, key, languageId);
};

/**
 *
 * 当具有嵌套结构的obj中有实现i18n需求的文字时，用此方法。、
 * 为没有经过是否一定具有i18n类型的校验，只当嵌套类型中出现I18nStringType时采用此方法。
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
  obj: TObject,
  key: TKey,
  languageId: string,
): TObject[TKey] extends I18nStringType ? string : string | undefined => {
  const value = obj[key];

  if (!value) {
    return undefined as any;
  }

  return getI18nConfigCurrentText(value as any, languageId);
};
