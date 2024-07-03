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

// @ts-check

const { envConfig, str, bool } = require("@scow/lib-config");
const { join } = require("path");
const { homedir } = require("os");
const { PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_SERVER, PHASE_TEST } = require("next/constants");

const { readVersionFile } = require("@scow/utils/build/version");
const { getCapabilities } = require("@scow/lib-auth");
const { DEFAULT_PRIMARY_COLOR, getUiConfig } = require("@scow/config/build/ui");
const { getPortalConfig } = require("@scow/config/build/portal");
const { getCommonConfig, getSystemLanguageConfig } = require("@scow/config/build/common");
const { getAuditConfig } = require("@scow/config/build/audit");
const { getAuditServiceConfig } = require("@scow/config/build/shellAudit");

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
    return { changePassword: true, createUser: true, validateName: true };
  }
}

const specs = {

  AUTH_EXTERNAL_URL: str({ desc: "认证系统的URL。如果和本系统域名相同，可以只写完整路径", default: "/auth" }),

  AUTH_INTERNAL_URL: str({ desc: "认证服务内网地址", default: "http://auth:5000" }),

  // 当前SCOW未使用覆写配置文件逻辑
  // LOGIN_NODES: str({ desc: "集群的登录节点。将会覆写配置文件。格式：集群ID=登录节点,集群ID=登录节点", default: "" }),

  SSH_PRIVATE_KEY_PATH: str({ desc: "SSH私钥路径", default: join(homedir(), ".ssh", "id_rsa") }),
  SSH_PUBLIC_KEY_PATH: str({ desc: "SSH公钥路径", default: join(homedir(), ".ssh", "id_rsa.pub") }),

  SERVER_URL: str({ desc: "门户后端的路径", default: "portal-server:5000" }),

  MOCK_USER_ID: str({ desc: "开发和测试的时候所使用的user id", default: undefined }),

  MIS_DEPLOYED: bool({ desc: "是否部署了管理系统", default: false }),
  MIS_URL: str({ desc: "如果部署了管理系统，管理系统的URL。如果和本系统域名相同，可以只写完整的路径。将会覆盖配置文件。空字符串等价于未部署管理系统", default: "" }),
  MIS_SERVER_URL: str({ desc: "如果部署了管理系统，管理系统后端的路径", default: "" }),

  AI_DEPLOYED: bool({ desc: "是否部署了AI系统", default: false }),
  AI_URL: str({ desc: "如果部署了AI系统，AI系统的URL。如果和本系统域名相同，可以只写完整路径。将会覆盖配置文件。空字符串等价于未部署AI系统", default: "" }),

  NOVNC_CLIENT_URL: str({ desc: "novnc客户端的URL。如果和本系统域名相同，可以只写完整路径", default: "/vnc" }),

  CLIENT_MAX_BODY_SIZE: str({ desc: "限制整个系统上传（请求）文件的大小，可接受的格式为nginx的client_max_body_size可接受的值", default: "1G" }),

  PUBLIC_PATH: str({ desc: "SCOW公共文件的路径，需已包含SCOW的base path", default: "/public/" }),

  AUDIT_DEPLOYED: bool({ desc: "是否部署了审计系统", default: false }),

  PROTOCOL: str({ desc: "scow 的访问协议，将影响 callbackUrl 的 protocol", default: "http" }),
};

const mockEnv = process.env.NEXT_PUBLIC_USE_MOCK === "1";

// This config is used to provide env doc auto gen
const config = { _specs: specs };

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
  const testenv = phase === PHASE_TEST;

  // load .env.build if in build
  if (building) {
    return { serverRuntimeConfig: {}, publicRuntimeConfig: {} };
  }

  if (dev) {
    require("dotenv").config({ path: "env/.env.dev" });
  }

  // reload config after envs are applied
  const config = envConfig(specs, process.env);

  const configPath = mockEnv ? join(__dirname, "config") : undefined;

  // Object.keys(clusters).map((id) => clusters[id].loginNodes = clusters[id].loginNodes.map(getLoginNode));

  const uiConfig = getUiConfig(configPath, console);
  const portalConfig = getPortalConfig(configPath, console);
  const commonConfig = getCommonConfig(configPath, console);
  const auditConfig = getAuditConfig(configPath, console);
  const auditServiceConfig = getAuditServiceConfig(configPath, console);

  const versionTag = readVersionFile()?.tag;
  /**
   * @type {import("./src/utils/config").ServerRuntimeConfig}
   */
  const serverRuntimeConfig = {
    AUTH_EXTERNAL_URL: config.AUTH_EXTERNAL_URL,
    AUTH_INTERNAL_URL: config.AUTH_INTERNAL_URL,
    PORTAL_CONFIG: portalConfig,
    DEFAULT_PRIMARY_COLOR,
    MOCK_USER_ID: config.MOCK_USER_ID,
    UI_CONFIG: uiConfig,
    // 当前SCOW未使用？
    // LOGIN_NODES: parseKeyValue(config.LOGIN_NODES),
    SERVER_URL: config.SERVER_URL,
    SUBMIT_JOB_WORKING_DIR: portalConfig.submitJobDefaultPwd,
    SCOW_API_AUTH_TOKEN: commonConfig.scowApi?.auth?.token,
    AUDIT_CONFIG: config.AUDIT_DEPLOYED ? auditConfig : undefined,
    SHELL_AUDIT_CONFIG: auditServiceConfig,

    SERVER_I18N_CONFIG_TEXTS: {
      submitJopPromptText: portalConfig.submitJobPromptText,
    },

    PROTOCOL: config.PROTOCOL,
  };

  // query auth capabilities to set optional auth features
  const capabilities = await queryCapabilities(config.AUTH_INTERNAL_URL, phase);

  const systemLanguageConfig = getSystemLanguageConfig(getCommonConfig().systemLanguage);

  /**
   * @type {import("./src/utils/config").PublicRuntimeConfig}
   */
  const publicRuntimeConfig = {

    ENABLE_CHANGE_PASSWORD: capabilities.changePassword,

    ENABLE_SHELL: portalConfig.shell,

    ENABLE_JOB_MANAGEMENT: portalConfig.jobManagement,

    ENABLE_APPS: portalConfig.apps,

    MIS_URL: config.MIS_DEPLOYED ? (config.MIS_URL || portalConfig.misUrl) : undefined,

    MIS_DEPLOYED: config.MIS_DEPLOYED,
    MIS_SERVER_URL: config.MIS_DEPLOYED ? config.MIS_SERVER_URL : undefined,

    AI_URL: config.AI_DEPLOYED ? (config.AI_URL || portalConfig.aiUrl) : undefined,

    NOVNC_CLIENT_URL: config.NOVNC_CLIENT_URL,

    PASSWORD_PATTERN: commonConfig.passwordPattern?.regex,

    BASE_PATH: basePath,

    CLIENT_MAX_BODY_SIZE: config.CLIENT_MAX_BODY_SIZE,

    FILE_EDIT_SIZE: portalConfig.file?.edit.limitSize,

    FILE_PREVIEW_SIZE: portalConfig.file?.preview.limitSize,

    PUBLIC_PATH: config.PUBLIC_PATH,

    NAV_LINKS: portalConfig.navLinks,

    USER_LINKS: commonConfig.userLinks,

    VERSION_TAG: versionTag,

    RUNTIME_I18N_CONFIG_TEXTS: {
      passwordPatternMessage: commonConfig.passwordPattern?.errorMessage,
    },

    SYSTEM_LANGUAGE_CONFIG: systemLanguageConfig,

    UI_EXTENSION: portalConfig.uiExtension,
  };

  if (!building && !testenv) {
    console.log("Running @scow/portal-web");
    console.log("Version", readVersionFile());
    console.log("Server Runtime Config", serverRuntimeConfig);
    console.log("Public Runtime Config", publicRuntimeConfig);

    // HACK setup ws proxy
    setTimeout(() => {
      const url = `http://localhost:${process.env.PORT || 3000}${join(basePath, "/api/setup")}`;
      console.log("Calling setup url to initialize proxy and shell server", url);

      fetch(url).then(async (res) => {
        console.log("Call completed. Response: ", await res.text());
      }).catch((e) => {
        console.error("Error when calling proxy url to initialize ws proxy server", e);
      });
    });

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
