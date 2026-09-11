const { envConfig, str, bool } = require("@scow/lib-config");
const { getMisConfig } = require("@scow/config/build/mis");
const { getCommonConfig, getSystemLanguageConfig } = require("@scow/config/build/common");
const { getClusterTextsConfig } = require("@scow/config/build/clusterTexts");
const { DEFAULT_PRIMARY_COLOR, getUiConfig } = require("@scow/config/build/ui");
const { getAuditConfig } = require("@scow/config/build/audit");
const { getAuthConfig } = require("@scow/config/build/auth");
const { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } = require("next/constants");
const { join } = require("path");
const { getCapabilities } = require("@scow/lib-auth");
const { readVersionFile } = require("@scow/utils/build/version");
const { getPublicStorageConfig } = require("@scow/config/build/storage");

/**
 * Get auth capabilities
 * @param {string} authUrl the url for auth service
 * @param {string} phase the build phase
 */
async function queryCapabilities(authUrl, phase) {
  if (phase === PHASE_PRODUCTION_SERVER) {
    // @ts-ignore
    return await getCapabilities(authUrl);
  } else {
    return { changePassword: true, createUser: true, validateName: true, changeEmail: true, deleteUser: true };
  }
}

const specs = {
  AUTH_EXTERNAL_URL: str({ desc: "认证系统的URL。如果部署在和本系统一样的域名下，可以只写完整路径", default: "/auth" }),

  SERVER_URL: str({ desc: "后端服务地址", default: "mis-server:5000" }),

  AUTH_ORIGIN: str({ desc: "认证系统的域名。如果认证系统和本系统部署在同一个域名下，不填写", default: undefined }),
  AUTH_INTERNAL_URL: str({ desc: "认证服务内网地址", default: "http://auth:5000" }),

  PORTAL_DEPLOYED: bool({ desc: "是否部署了门户系统", default: false }),
  PORTAL_URL: str({
    desc: "如果部署了门户系统，门户系统的URL。如果和本系统域名相同，可以只写完整路径。将会覆盖配置文件。空字符串等价于未部署门户系统",
    default: "",
  }),

  AI_DEPLOYED: bool({ desc: "是否部署了AI系统", default: false }),
  AI_URL: str({
    desc: "如果部署了AI系统，AI系统的URL。如果和本系统域名相同，可以只写完整路径。将会覆盖配置文件。空字符串等价于未部署AI系统",
    default: "",
  }),

  QUANTUM_DEPLOYED: bool({ desc: "是否部署了量子系统", default: false }),
  QUANTUM_URL: str({
    desc: "如果部署了量子系统，量子系统的URL。如果和本系统域名相同，可以只写完整路径。将会覆盖配置文件。空字符串等价于未部署量子系统",
    default: "",
  }),

  PUBLIC_PATH: str({ desc: "SCOW公共文件的路径，需已包含SCOW的base path", default: "/public/" }),

  PROTOCOL: str({ desc: "scow 的访问协议，将影响 callbackUrl 的 protocol", default: "http" }),
};

const mockEnv = process.env.NEXT_PUBLIC_USE_MOCK === "1";

const config = envConfig(specs, process.env);

/**
 * Build system runtime config
 * @param {string} phase Next.js phase
 * @param {string} basePath basePath of the system
 * @returns RuntimeConfig
 */
const buildRuntimeConfig = async (phase, basePath) => {
  // https://github.com/vercel/next.js/issues/57927
  // const building = phase === PHASE_PRODUCTION_BUILD;
  const building = process.env.BUILDING === "1";

  const dev = phase === PHASE_DEVELOPMENT_SERVER;
  // const production = phase === PHASE_PRODUCTION_SERVER;

  if (building) {
    return { serverRuntimeConfig: {}, publicRuntimeConfig: {} };
  }

  if (dev) {
    require("dotenv").config({ path: "env/.env.dev" });
  }

  const config = envConfig(specs, process.env);

  // query auth capabilities to set optional auth features
  const capabilities = await queryCapabilities(config.AUTH_INTERNAL_URL, phase);
  const configBasePath = mockEnv ? join(__dirname, "config") : undefined;

  const clusterTexts = getClusterTextsConfig(configBasePath, console);
  const uiConfig = getUiConfig(configBasePath, console);
  const misConfig = getMisConfig(configBasePath, console);

  const commonConfig = getCommonConfig(configBasePath, console);
  const auditConfig = getAuditConfig(configBasePath, console);
  const authConfig = getAuthConfig(configBasePath, console);
  const publicStorageConfig = getPublicStorageConfig(configBasePath, console);

  const versionTag = readVersionFile()?.tag;

  const systemLanguageConfig = getSystemLanguageConfig(getCommonConfig().systemLanguage);

  /**
   * @type {import ("./src/utils/config").ServerRuntimeConfig}
   */
  const serverRuntimeConfig = {
    AUTH_EXTERNAL_URL: config.AUTH_EXTERNAL_URL,
    AUTH_INTERNAL_URL: config.AUTH_INTERNAL_URL,
    CLUSTER_TEXTS_CONFIG: clusterTexts,
    UI_CONFIG: uiConfig,
    DEFAULT_PRIMARY_COLOR,
    SERVER_URL: config.SERVER_URL,
    SCOW_API_AUTH_TOKEN: commonConfig.scowApi.auth.token,
    AUDIT_CONFIG: auditConfig,
    PROTOCOL: config.PROTOCOL,
    SCOW_RESOURCE_CONFIG: commonConfig.scowResource,
  };

  /**
   * @type {import("./src/utils/config").PublicRuntimeConfig}
   */
  const publicRuntimeConfig = {
    AUTH_PPOLICY_CONFIG: {
      defaultOlcPPolicyDn: authConfig.ldap?.ppolicy?.defaultOlcPPolicyDn,
      pwdMaxFailures: authConfig.ldap?.ppolicy?.pwdMaxFailures,
    },

    UI_CONFIG: uiConfig,

    CREATE_USER_CONFIG: {
      misConfig: misConfig.createUser,
      authSupportsCreateUser: capabilities.createUser,
    },

    DELETE_USER_CONFIG: {
      misConfig: misConfig.deleteUser ? misConfig.deleteUser : undefined,
      authSupportsDeleteUser: capabilities.deleteUser,
    },

    DELETE_ACCOUNT_CONFIG: misConfig.deleteAccount ? misConfig.deleteAccount : undefined,

    ADD_USER_TO_ACCOUNT: {
      accountAdmin: misConfig.addUserToAccount.accountAdmin,
    },
    ENABLE_CHANGE_PASSWORD: capabilities.changePassword,
    ENABLE_CHANGE_EMAIL: capabilities.changeEmail,
    PREDEFINED_CHARGING_TYPES: misConfig.predefinedChargingTypes,

    PUBLIC_PATH: config.PUBLIC_PATH,

    ACCOUNT_NAME_PATTERN: misConfig.accountNamePattern?.regex,

    PORTAL_URL: config.PORTAL_DEPLOYED ? config.PORTAL_URL || misConfig.portalUrl || "" : undefined,

    AI_URL: config.AI_DEPLOYED ? config.AI_URL || misConfig.aiUrl || "" : undefined,

    QUANTUM_URL: config.QUANTUM_DEPLOYED ? config.QUANTUM_URL || misConfig.quantumUrl : undefined,

    PASSWORD_PATTERN: commonConfig.passwordPattern?.regex,

    BASE_PATH: basePath,

    NAV_LINKS: misConfig.navLinks,

    NODE_MIGRATION: misConfig.nodeMigration,

    CUSTOM_AMOUNT_STRATEGIES: misConfig.customAmountStrategies,

    USER_LINKS: commonConfig.userLinks,

    VERSION_TAG: versionTag,

    RUNTIME_I18N_CONFIG_TEXTS: {
      accountNamePatternMessage: misConfig.accountNamePattern?.errorMessage,
      passwordPatternMessage: commonConfig.passwordPattern?.errorMessage,
      createUserBuiltinErrorMessage: misConfig.createUser?.userIdPattern?.errorMessage,
      createUserErrorMessage: misConfig.createUser?.builtin?.userIdPattern?.errorMessage,
    },

    CHARGE_TYPE_LIST: [
      misConfig.jobChargeType,
      misConfig.changeJobPriceType,
      ...(config.QUANTUM_DEPLOYED ? [misConfig.quantumJobChargeType] : []),
      ...(misConfig.storageBilling?.enabled ? [misConfig.storageBilling.chargeType] : []),
      ...(misConfig.customChargeTypes || []),
    ],

    SYSTEM_LANGUAGE_CONFIG: systemLanguageConfig,

    CLUSTER_MONITOR: {
      grafanaUrl: misConfig.clusterMonitor?.grafanaUrl,
      resourceStatus: {
        enabled: misConfig.clusterMonitor?.resourceStatus?.enabled,
        proxy: misConfig.clusterMonitor?.resourceStatus?.proxy,
        dashboardUid: misConfig.clusterMonitor?.resourceStatus?.dashboardUid,
        dashboards: misConfig.clusterMonitor?.resourceStatus?.dashboards,
      },
      alarmLogs: {
        enabled: misConfig.clusterMonitor?.alarmLogs?.enabled,
      },
    },

    UI_EXTENSION: misConfig.uiExtension,

    CHANGE_JOB_LIMIT: {
      allowUserAndAccountAdmin: misConfig.allowUserChangeJobTimeLimit, // 这个是是否允许用户和账户管理员的
    },

    JOB_CHARGE_METADATA: misConfig.jobChargeMetadata,

    JOB_CHARGE_DECIMAL_PRECISION: misConfig.jobChargeDecimalPrecision,
    JOB_MIN_CHARGE: misConfig.jobMinCharge,

    NOTIF_ADDRESS: commonConfig.notification.address,

    BILL_ENABLED: misConfig.bill?.enabled,
    STORAGE_BILLING_ENABLED: misConfig.storageBilling?.enabled,
    CHANGE_JOB_PRICE_TYPE: misConfig.changeJobPriceType,

    SYNC_HISTORY_DAY_PERIOD: misConfig.syncAccountUser.syncHistoryDayPeriod,
    MAX_SYNC_DURATION_MINUTES: misConfig.syncAccountUser.maxSyncDurationMinutes,

    MAX_EXPORT_COUNT: misConfig.maxExportCount,

    ROOT_SHELL_ENABLED: misConfig.rootShell?.enabled,

    PUBLIC_STORAGE_CONFIG: publicStorageConfig,
  };

  if (!building) {
    console.log("Running @scow/mis-web");
    console.log("Version: ", readVersionFile());
    console.log("Server Runtime Config", serverRuntimeConfig);
    console.log("Public Runtime Config", publicRuntimeConfig);
  }

  return {
    serverRuntimeConfig,
    publicRuntimeConfig,
  };
};

module.exports = {
  buildRuntimeConfig,
  config,
};
