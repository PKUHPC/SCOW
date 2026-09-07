import type { AuthPpolicyConfigSchema } from "@scow/config/build/auth";
import type { ClusterTextsConfigSchema } from "@scow/config/build/clusterTexts";
import type { MisConfigSchema } from "@scow/config/build/mis";
import type { UiConfigSchema } from "@scow/config/build/ui";

import { AuditConfigSchema } from "@scow/config/build/audit";
import { ScowResourceConfigSchema } from "@scow/config/build/common";
import { I18nStringType, SystemLanguageConfig } from "@scow/config/build/i18n";
import { UiExtensionConfigSchema } from "@scow/config/build/uiExtensions";
import { UserLink } from "@scow/lib-web/build/layouts/base/types";
import { getI18nConfigCurrentText } from "@scow/lib-web/build/utils/systemLanguage";

export interface ServerRuntimeConfig {
  AUTH_EXTERNAL_URL: string;
  AUTH_INTERNAL_URL: string;

  SERVER_URL: string;

  UI_CONFIG: UiConfigSchema | undefined;
  DEFAULT_PRIMARY_COLOR: string;

  CLUSTER_TEXTS_CONFIG: ClusterTextsConfigSchema;

  SCOW_API_AUTH_TOKEN: string;

  AUDIT_CONFIG: AuditConfigSchema;

  SERVER_I18N_CONFIG_TEXTS: {};

  PROTOCOL: string;

  SCOW_RESOURCE_CONFIG: ScowResourceConfigSchema;
}

export interface PublicRuntimeConfig {
  AUTH_PPOLICY_CONFIG: AuthPpolicyConfigSchema;

  UI_CONFIG: UiConfigSchema | undefined;

  BASE_PATH: string;

  PREDEFINED_CHARGING_TYPES: string[];
  CREATE_USER_CONFIG: {
    misConfig: MisConfigSchema["createUser"];
    authSupportsCreateUser: boolean | undefined;
  };

  DELETE_USER_CONFIG?: {
    misConfig: MisConfigSchema["deleteUser"];
    authSupportsDeleteUser: boolean | undefined;
  };

  DELETE_ACCOUNT_CONFIG?: MisConfigSchema["deleteAccount"];

  NODE_MIGRATION?: MisConfigSchema["nodeMigration"];

  ADD_USER_TO_ACCOUNT: {
    accountAdmin: {
      allowed: boolean;
      createUserIfNotExist: boolean;
    };
  };
  ENABLE_CHANGE_PASSWORD: boolean | undefined;

  ACCOUNT_NAME_PATTERN: string | undefined;

  PASSWORD_PATTERN: string | undefined;

  PORTAL_URL: string | undefined;

  AI_URL: string | undefined;

  QUANTUM_URL: string | undefined;

  PUBLIC_PATH: string;

  NAV_LINKS?: NavLink[];

  CUSTOM_AMOUNT_STRATEGIES?: CustomAmountStrategy[];

  USER_LINKS?: UserLink[];

  VERSION_TAG: string | undefined;

  RUNTIME_I18N_CONFIG_TEXTS: {
    passwordPatternMessage: I18nStringType | undefined;
    accountNamePatternMessage: I18nStringType | undefined;
    createUserBuiltinErrorMessage: I18nStringType | undefined;
    createUserErrorMessage: I18nStringType | undefined;
  };

  CHARGE_TYPE_LIST: string[];

  SYSTEM_LANGUAGE_CONFIG: SystemLanguageConfig;

  CLUSTER_MONITOR: {
    grafanaUrl: string | undefined;
    resourceStatus: {
      enabled: boolean | undefined;
      proxy: boolean | undefined;
      dashboardUid: string | undefined;
      dashboards?: Dashboards[];
    };
    alarmLogs: { enabled: boolean | undefined };
  };

  UI_EXTENSION?: UiExtensionConfigSchema;

  CHANGE_JOB_LIMIT: { allowUserAndAccountAdmin: boolean };

  JOB_CHARGE_METADATA: jobChargeMetadataType;

  JOB_CHARGE_DECIMAL_PRECISION: number;
  JOB_MIN_CHARGE: number;

  NOTIF_ADDRESS: string;

  BILL_ENABLED?: boolean;
  CHANGE_JOB_PRICE_TYPE: string;

  SYNC_HISTORY_DAY_PERIOD: MisConfigSchema["syncAccountUser"]["syncHistoryDayPeriod"];
  MAX_SYNC_DURATION_MINUTES: MisConfigSchema["syncAccountUser"]["maxSyncDurationMinutes"];

  MAX_EXPORT_COUNT: number;

  ROOT_SHELL_ENABLED?: boolean;
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

export interface Dashboards {
  uid: string;
  label: string;
}

export interface NavLink {
  text: string;
  url?: string;
  openInNewPage?: boolean;
  iconPath?: string;
  allowedRoles?: string[];
  clickable?: boolean;
  children?: (Omit<NavLink, "children" | "url"> & { url: string })[];
}

export interface CustomAmountStrategy {
  id: string;
  script: string;
  name?: string | undefined;
  comment?: string | undefined;
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
  obj: TObject | undefined,
  key: TKey,
  languageId: string,
): TObject[TKey] extends I18nStringType ? string : string | undefined => {
  if (!obj) {
    return undefined as any;
  }
  const value = obj[key];

  if (!value) {
    return undefined as any;
  }

  return getI18nConfigCurrentText(value as any, languageId);
};

export type jobChargeMetadataType = MisConfigSchema["jobChargeMetadata"];
