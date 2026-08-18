import { getClusterConfigs } from "@scow/config/build/cluster";
import { chmodSync, mkdirSync } from "fs";
import path from "path";
import { LoggingOption, ServiceSpec } from "src/compose/spec";
import { AuthCustomType, InstallConfigSchema } from "src/config/install";
import { logger } from "src/log";
import { prepareUchipHostDirAndPragmaFiles } from "src/utils/uchip";

const IMAGE: string = "ccrepo.pku.edu.cn/scow/scow";
const DEFAULT_NOVNC_CLIENT_IMAGE: string = "ghcr.io/pkuhpc/novnc-client-docker:master";

function checkPathFormat(configKey: string, value: string) {
  if (value !== "/" && value.endsWith("/")) {
    throw new Error(`Invalid config: ${configKey} should not end with '/'`);
  }
}

function join(...segments: string[]) {
  const r = path.normalize(path.join(...segments));
  if (r !== "/" && r.endsWith("/")) {
    return r.substring(0, r.length - 1);
  }
  return r;
}

export const createComposeSpec = (config: InstallConfigSchema) => {
  // 如果install.yaml没有配置image则使用默认image
  const scowImage = `${config.image || IMAGE}:${config.imageTag}`;

  // 检查 集群ai 配置 - 如果启用了 ai 模块，则相关集群中必须配置公共数据资产目录
  if (config.ai?.enabled) {
    try {
      const clustersConfig = getClusterConfigs();

      Object.values(clustersConfig).forEach((cluster) => {
        const aiConfig = cluster.ai;

        if (aiConfig?.enabled && !aiConfig.clusterPublicPath?.trim()) {
          let clusterDisplayName;

          if (typeof cluster.displayName === "string") {
            clusterDisplayName = cluster.displayName;
          } else {
            clusterDisplayName = cluster.displayName.i18n.default;
          }

          throw new Error(
            "The public data asset directory (clusterPublicPath) is required because the AI" +
              " module is enabled on this cluster. " +
              `Please configure 'ai.clusterPublicPath' for cluster ${clusterDisplayName} in the cluster configuration.`,
          );
        }
      });
    } catch (error) {
      logger.error("Failed to check clusterPublicPath configuration:", error);
      throw error;
    }
  }

  const BASE_PATH = config.basePath;
  checkPathFormat("basePath", BASE_PATH);

  const PORTAL_PATH = config.portal?.basePath || "/";
  checkPathFormat("portal.basePath", PORTAL_PATH);
  const portalBasePath = join(BASE_PATH, PORTAL_PATH);

  const MIS_PATH = config.mis.basePath;
  checkPathFormat("mis.basePath", MIS_PATH);

  const AI_PATH = config.ai?.basePath || "/ai";
  checkPathFormat("ai.basePath", AI_PATH);

  const QUANTUM_PATH = config.quantum?.basePath || "/quantum";
  checkPathFormat("quantum.basePath", QUANTUM_PATH);

  const RESOURCE_PATH = config.resource.basePath;
  checkPathFormat("resource.basePath", RESOURCE_PATH);

  const NOTIFICATION_PATH = config.notification.basePath;
  checkPathFormat("notification.basePath", NOTIFICATION_PATH);

  const serviceLogEnv = {
    LOG_LEVEL: config.log.level,
    LOG_PRETTY: String(config.log.pretty),
  };

  const composeSpec = {
    services: {} as Record<string, ServiceSpec>,
    volumes: {} as Record<string, object>,
  };

  const nodeOptions = config.misc?.nodeOptions;

  // SCOWD 证书相关配置
  const scowdSslCaCertPath = config.scowd?.ssl?.caCertPath ? join("/etc/scow", config.scowd.ssl.caCertPath) : "";
  const scowdSslScowCertPath = config.scowd?.ssl?.scowCertPath ? join("/etc/scow", config.scowd.ssl.scowCertPath) : "";
  const scowdSslScowPrivateKeyPath = config.scowd?.ssl?.scowPrivateKeyPath
    ? join("/etc/scow", config.scowd.ssl.scowPrivateKeyPath)
    : "";

  // 适配器证书相关配置
  const adapterSslCaCertPath = config.adapter?.ssl?.caCertPath ? join("/etc/scow", config.adapter.ssl.caCertPath) : "";
  const adapterSslScowCertPath = config.adapter?.ssl?.scowCertPath
    ? join("/etc/scow", config.adapter.ssl.scowCertPath)
    : "";
  const adapterSslScowPrivateKeyPath = config.adapter?.ssl?.scowPrivateKeyPath
    ? join("/etc/scow", config.adapter.ssl.scowPrivateKeyPath)
    : "";

  // service creation function
  const addService = (
    name: string,
    options: {
      image: string;
      healthcheck?: ServiceSpec["healthcheck"];
      environment: string[] | Record<string, string>;
      ports: string[] | Record<string, number>;
      volumes: string[] | Record<string, string>;
    },
  ) => {
    const logging: LoggingOption | undefined = config.log.fluentd
      ? {
          driver: "fluentd",
          options: {
            "fluentd-address": "localhost:24224",
            mode: "non-blocking",
            tag: name,
          },
        }
      : undefined;

    function toStringArray(dict: Record<string, string | number>, splitter: string) {
      return Object.entries(dict).map(([from, to]) => `${from}${splitter}${to}`);
    }

    composeSpec.services[name] = {
      restart: "unless-stopped",
      healthcheck: options.healthcheck,
      environment: Array.isArray(options.environment) ? options.environment : toStringArray(options.environment, "="),
      ports: Array.isArray(options.ports) ? options.ports : toStringArray(options.ports, ":"),
      image: options.image,
      volumes: Array.isArray(options.volumes) ? options.volumes : toStringArray(options.volumes, ":"),
      depends_on: logging && name !== "log" ? { log: { condition: "service_healthy" } } : undefined,
      logging: logging && name !== "log" ? logging : undefined,
    };
  };

  // fluentd
  if (config.log.fluentd) {
    // create log dir
    mkdirSync(config.log.fluentd.logDir, { recursive: true });
    // TODO may give fewer permissions
    chmodSync(config.log.fluentd.logDir, 0o777);

    addService("log", {
      image: config.log.fluentd.image,
      healthcheck: {
        test: "nc -z 0.0.0.0 24224",
        interval: "5s",
        timeout: "5s",
        retries: 3,
      },
      environment: {},
      ports: ["24224:24224", "24224:24224/udp"],
      volumes: {
        [config.log.fluentd.logDir]: "/fluentd/log",
        "./fluent/fluent.conf": "/fluentd/etc/fluent.conf",
      },
    });
  }

  const publicPath = "/__public__/";
  const publicDir = "/app/apps/gateway/public/";

  const defaultServerBlock = `server {
    listen 80 default_server;
    return 444;
  }`;

  // quantum的芯片映射
  const chipMapping = new URLSearchParams({
    t40: "tianxuan_s2",
    t12: "tianji_s2",
    t60: "tianji_m1",
    t57: "tianji_m2",
    t57v15s1: "tianji_m2v16s1",
    t57v14s2: "tianji_m2v14s2",
    t57v15s3: "tianji_m2v15s3",
    t57v13s4: "tianji_m2v14s4",
    t12v5: "tianji_s2v6",
    t12v7: "tianji_s2v7",
  });

  const vncEnabled = !!(config.portal?.enabled || config.ai?.enabled);
  // GATEWAY
  addService("gateway", {
    image: scowImage,
    environment: {
      SCOW_LAUNCH_APP: "gateway",
      BASE_PATH: BASE_PATH == "/" ? "" : BASE_PATH,
      PORTAL_ENABLED: String(config.portal?.enabled ?? false),
      PORTAL_PATH: PORTAL_PATH,
      MIS_PATH: MIS_PATH,
      AI_ENABLED: String(config.ai?.enabled ?? false),
      AI_PATH: AI_PATH,
      RESOURCE_PATH: RESOURCE_PATH,
      NOTIFICATION_PATH: NOTIFICATION_PATH,
      QUANTUM_ENABLED: String(config.quantum?.enabled ?? false),
      QUANTUM_PATH: QUANTUM_PATH,
      VNC_ENABLED: String(vncEnabled),
      CLIENT_MAX_BODY_SIZE: config.gateway.uploadFileSizeLimit,
      PROXY_READ_TIMEOUT: config.gateway.proxyReadTimeout,
      PUBLIC_PATH: publicPath,
      PUBLIC_DIR: publicDir,
      EXTRA: config.gateway.extra,
      ALLOWED_SERVER_NAME: config.gateway.allowedServerName,
      DEFAULT_SERVER_BLOCK: config.gateway.allowedServerName === "_" ? "" : defaultServerBlock,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    ports: { [config.port]: 80 },
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./public": publicDir,
    },
  });

  addService("meta-server", {
    image: scowImage,
    environment: {
      SCOW_LAUNCH_APP: "meta-server",
      INSTALL_CONFIG_PATH: "/etc/scow/install.yaml",
      ...serviceLogEnv,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    ports: {},
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./install.yaml": "/etc/scow/install.yaml",
    },
  });

  // AUTH

  addService("redis", {
    image: config.auth.redisImage,
    ports: config.auth.portMappings?.redis ? { [config.auth.portMappings?.redis]: 6379 } : {},
    environment: {},
    volumes: {},
  });

  const authVolumes = {
    "/etc/hosts": "/etc/hosts",
    "./config": "/etc/scow",
    "~/.ssh": "/root/.ssh",
  };

  const authUrl =
    config.auth.custom?.type === AuthCustomType.external ? config.auth.custom.external?.url : "http://auth:5000";

  // 是否配置自定义认证系统
  if (config.auth.custom) {
    // 未配置 type，则为旧版本自定义认证系统配置
    if (config.auth.custom.type === undefined) {
      if (config.auth.custom.image === undefined) {
        throw new Error("Invalid config: auth/custom/image is required");
      }

      for (const key in config.auth.custom.volumes) {
        authVolumes[key] = config.auth.custom.volumes[key];
      }

      if (typeof config.auth.custom.image === "object" && config.auth.custom.image !== null) {
        throw new Error(
          "Invalid config: " +
            "auth/custom/image in the old version of the custom authentication system configuration is a string",
        );
      }

      logger.info(
        "The current configuration of the custom authentication system is outdated, " +
          "please read the relevant configuration documentation and update it.",
      );

      addService("auth", {
        image: config.auth.custom.image,
        ports: config.auth.custom.ports ?? {},
        environment: config.auth.custom.environment ?? {},
        volumes: authVolumes,
      });
    } else {
      // 新版自定义认证系统配置

      // 镜像类型的自定义认证系统
      if (config.auth.custom.type === AuthCustomType.image) {
        if (config.auth.custom.image === undefined) {
          throw new Error("Invalid config: auth/custom/image is required");
        }

        if (typeof config.auth.custom.image === "string") {
          throw new Error("Invalid config: auth/custom/image is an object, but it is passed as a string");
        }
        const image = config.auth.custom.image.imageName;

        for (const key in config.auth.custom.image.volumes) {
          authVolumes[key] = config.auth.custom.image.volumes[key];
        }

        addService("auth", {
          image,
          ports: config.auth.custom.image.ports ?? {},
          environment: config.auth.custom.environment ?? {},
          volumes: authVolumes,
        });
      } else if (config.auth.custom.type === AuthCustomType.external) {
        if (authUrl === undefined) {
          throw new Error("Invalid config: when /auth/custom/type is external, /auth/custom/external/url is required");
        }
      }
    }
  } else {
    const portalBasePath = join(BASE_PATH, PORTAL_PATH);
    // 根据已启动的子系统决定默认首页路径
    // 如果 portal/ai/mis都没有启用那么按照原始逻辑仍然指定默认的portalBasePath
    const defaultSetupHomePath = config.portal?.enabled
      ? portalBasePath
      : config.ai?.enabled
        ? join(BASE_PATH, AI_PATH)
        : join(BASE_PATH, MIS_PATH);

    addService("auth", {
      image: scowImage,
      environment: {
        SCOW_LAUNCH_APP: "auth",
        BASE_PATH: BASE_PATH,
        DEFAULT_SETUP_HOME_PATH: defaultSetupHomePath,
        ...serviceLogEnv,
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
      ports: config.auth.portMappings?.auth ? { [config.auth.portMappings?.auth]: 5000 } : {},
      volumes: authVolumes,
    });
  }

  // PORTAL
  if (config.portal?.enabled) {
    const configPath = "/etc/scow";

    composeSpec.volumes.portal_data = {};

    addService("portal-server", {
      image: scowImage,
      environment: {
        SCOW_LAUNCH_APP: "portal-server",
        PORTAL_BASE_PATH: portalBasePath,

        SCOWD_SSL_ENABLED: String(config.scowd?.ssl?.enabled ?? false),
        SCOWD_SSL_CA_CERT_PATH: scowdSslCaCertPath,
        SCOWD_SSL_SCOW_CERT_PATH: scowdSslScowCertPath,
        SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: scowdSslScowPrivateKeyPath,

        ADAPTER_SSL_ENABLED: String(config.adapter?.ssl?.enabled ?? false),
        ADAPTER_SSL_CA_CERT_PATH: adapterSslCaCertPath,
        ADAPTER_SSL_SCOW_CERT_PATH: adapterSslScowCertPath,
        ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: adapterSslScowPrivateKeyPath,

        MIS_SERVER_URL: "mis-server:5000",
        ...serviceLogEnv,
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
      ports: config.portal.portMappings?.portalServer ? { [config.portal.portMappings.portalServer]: 5000 } : {},
      volumes: {
        "/etc/hosts": "/etc/hosts",
        "./config": configPath,
        "~/.ssh": "/root/.ssh",
        portal_data: "/var/lib/scow/portal",
      },
    });

    addService("portal-web", {
      image: scowImage,
      environment: {
        SCOW_LAUNCH_APP: "portal-web",
        BASE_PATH: portalBasePath,
        MIS_URL: join(BASE_PATH, MIS_PATH),
        MIS_SERVER_URL: "mis-server:5000",
        AI_URL: join(BASE_PATH, AI_PATH),
        AI_DEPLOYED: config.ai?.enabled ? "true" : "false",
        QUANTUM_URL: join(BASE_PATH, QUANTUM_PATH),
        QUANTUM_DEPLOYED: config.quantum?.enabled ? "true" : "false",
        AUTH_EXTERNAL_URL: config.auth.custom?.external?.url || join(BASE_PATH, "/auth"),
        AUTH_INTERNAL_URL: authUrl || "http://auth:5000",
        NOVNC_CLIENT_URL: join(BASE_PATH, "/vnc"),
        PUBLIC_PATH: join(BASE_PATH, publicPath),
        PROTOCOL: config.gateway.protocol,
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
      ports: {},
      volumes: {
        "/etc/hosts": "/etc/hosts",
        "./config": configPath,
      },
    });
  }

  // MIS
  addService("mis-server", {
    image: scowImage,
    ports: config.mis.portMappings?.misServer ? { [config.mis.portMappings.misServer]: 5000 } : {},
    environment: {
      SCOW_LAUNCH_APP: "mis-server",
      DB_PASSWORD: config.mis.dbPassword,
      QUANTUM_PATH: QUANTUM_PATH,
      QUANTUM_DEPLOYED: config.quantum?.enabled ? "true" : "false",
      AUTH_URL: config.auth.custom?.external?.url ?? "",

      SCOWD_SSL_ENABLED: String(config.scowd?.ssl?.enabled ?? false),
      SCOWD_SSL_CA_CERT_PATH: scowdSslCaCertPath,
      SCOWD_SSL_SCOW_CERT_PATH: scowdSslScowCertPath,
      SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: scowdSslScowPrivateKeyPath,

      ADAPTER_SSL_ENABLED: String(config.adapter?.ssl?.enabled ?? false),
      ADAPTER_SSL_CA_CERT_PATH: adapterSslCaCertPath,
      ADAPTER_SSL_SCOW_CERT_PATH: adapterSslScowCertPath,
      ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: adapterSslScowPrivateKeyPath,

      ...serviceLogEnv,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./config": "/etc/scow",
      "~/.ssh": "/root/.ssh",
    },
  });

  addService("mis-web", {
    image: scowImage,
    environment: {
      SCOW_LAUNCH_APP: "mis-web",
      BASE_PATH: join(BASE_PATH, MIS_PATH),
      PORTAL_URL: join(BASE_PATH, PORTAL_PATH),
      PORTAL_DEPLOYED: config.portal?.enabled ? "true" : "false",
      AI_URL: join(BASE_PATH, AI_PATH),
      AI_DEPLOYED: config.ai?.enabled ? "true" : "false",
      QUANTUM_URL: join(BASE_PATH, QUANTUM_PATH),
      QUANTUM_DEPLOYED: config.quantum?.enabled ? "true" : "false",
      AUTH_EXTERNAL_URL: config.auth.custom?.external?.url || join(BASE_PATH, "/auth"),
      AUTH_INTERNAL_URL: authUrl || "http://auth:5000",
      PUBLIC_PATH: join(BASE_PATH, publicPath),
      PROTOCOL: config.gateway.protocol,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    ports: {},
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./config": "/etc/scow",
    },
  });

  composeSpec.volumes.db_data = {};

  addService("db", {
    image: config.mis.mysqlImage,
    volumes: {
      db_data: "/var/lib/mysql",
    },
    environment: {
      MYSQL_ROOT_PASSWORD: config.mis.dbPassword,
    },
    ports: config.mis.portMappings?.db ? { [config.mis.portMappings?.db]: 3306 } : {},
  });

  // AUDIT
  addService("audit-server", {
    image: scowImage,
    ports: config.audit.portMappings?.auditServer ? { [config.audit.portMappings.auditServer]: 5000 } : {},
    environment: {
      SCOW_LAUNCH_APP: "audit-server",
      DB_PASSWORD: config.audit.dbPassword,
      ...serviceLogEnv,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./config": "/etc/scow",
    },
  });

  composeSpec.volumes.audit_db_data = {};

  addService("audit-db", {
    image: config.audit.mysqlImage,
    volumes: {
      audit_db_data: "/var/lib/mysql",
    },
    environment: {
      MYSQL_ROOT_PASSWORD: config.audit.dbPassword,
    },
    ports: config.audit.portMappings?.db ? { [config.audit.portMappings?.db]: 3306 } : {},
  });

  if (config.ai?.enabled) {
    addService("ai", {
      image: scowImage,
      ports: {},
      environment: {
        SCOW_LAUNCH_APP: "ai",
        NEXT_PUBLIC_BASE_PATH: join(BASE_PATH, AI_PATH),
        MIS_URL: join(BASE_PATH, MIS_PATH),
        MIS_SERVER_URL: "mis-server:5000",
        DB_PASSWORD: config.ai.dbPassword,
        PORTAL_URL: join(BASE_PATH, PORTAL_PATH),
        PORTAL_DEPLOYED: config.portal?.enabled ? "true" : "false",
        QUANTUM_URL: join(BASE_PATH, QUANTUM_PATH),
        QUANTUM_DEPLOYED: config.quantum?.enabled ? "true" : "false",
        AUTH_EXTERNAL_URL: config.auth.custom?.external?.url || join(BASE_PATH, "/auth"),
        AUTH_INTERNAL_URL: authUrl || "http://auth:5000",
        PUBLIC_PATH: join(BASE_PATH, publicPath),
        PROTOCOL: config.gateway.protocol,
        NOVNC_CLIENT_URL: join(BASE_PATH, "/vnc"),

        ADAPTER_SSL_ENABLED: String(config.adapter?.ssl?.enabled ?? false),
        ADAPTER_SSL_CA_CERT_PATH: adapterSslCaCertPath,
        ADAPTER_SSL_SCOW_CERT_PATH: adapterSslScowCertPath,
        ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: adapterSslScowPrivateKeyPath,

        SCOWD_SSL_ENABLED: String(config.scowd?.ssl?.enabled ?? false),
        SCOWD_SSL_CA_CERT_PATH: scowdSslCaCertPath,
        SCOWD_SSL_SCOW_CERT_PATH: scowdSslScowCertPath,
        SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: scowdSslScowPrivateKeyPath,

        ...serviceLogEnv,
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
      volumes: {
        "/etc/hosts": "/etc/hosts",
        "./config": "/etc/scow",
        "~/.ssh": "/root/.ssh",
      },
    });

    composeSpec.volumes.ai_db_data = {};

    addService("ai-db", {
      image: config.ai.mysqlImage,
      volumes: {
        ai_db_data: "/var/lib/mysql",
      },
      environment: {
        MYSQL_ROOT_PASSWORD: config.ai.dbPassword,
      },
      ports: config.ai.portMappings?.db ? { [config.ai.portMappings?.db]: 3306 } : {},
    });
  }

  if (config.quantum?.enabled) {
    if (!config.portal?.enabled) {
      throw new Error("Invalid config: quantum requires portal to be enabled");
    }

    addService("quantum", {
      image: scowImage,
      ports: {},
      environment: {
        SCOW_LAUNCH_APP: "quantum",
        NEXT_PUBLIC_BASE_PATH: join(BASE_PATH, QUANTUM_PATH),
        DB_PASSWORD: config.mis.dbPassword,
        MIS_URL: join(BASE_PATH, MIS_PATH),
        MIS_SERVER_URL: "mis-server:5000",
        PORTAL_URL: join(BASE_PATH, PORTAL_PATH),
        PORTAL_INTERNAL_URL: `http://portal-web:3000${portalBasePath === "/" ? "" : portalBasePath}`,
        PORTAL_SERVER_URL: config.portal?.enabled ? "portal-server:5000" : "",
        AI_URL: join(BASE_PATH, AI_PATH),
        AI_DEPLOYED: config.ai?.enabled ? "true" : "false",
        PUBLIC_PATH: join(BASE_PATH, publicPath),
        PROTOCOL: config.gateway.protocol,
        AUTH_EXTERNAL_URL: config.auth.custom?.external?.url || join(BASE_PATH, "/auth"),
        AUTH_INTERNAL_URL: authUrl || "http://auth:5000",

        ADAPTER_SSL_ENABLED: String(config.adapter?.ssl?.enabled ?? false),
        ADAPTER_SSL_CA_CERT_PATH: adapterSslCaCertPath,
        ADAPTER_SSL_SCOW_CERT_PATH: adapterSslScowCertPath,
        ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: adapterSslScowPrivateKeyPath,

        ...serviceLogEnv,
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      },
      volumes: {
        "/etc/hosts": "/etc/hosts",
        "./config": "/etc/scow",
        "~/.ssh": "/root/.ssh",
      },
    });

    const hostUChipPath = "./config/quantum/uchip";
    prepareUchipHostDirAndPragmaFiles(hostUChipPath);

    addService("qobody", {
      image: config.quantum.qobody.image,
      ports: {},
      environment: {
        QOST_TOKEN: config.quantum.qobody.token,
        QOST_CHIPS: chipMapping.toString(),
      },
      volumes: {
        "./config/quantum/uchip": "/app/uchip",
      },
    });
  }

  // NOVNC
  // portal 或 AI 启用时都需要 novnc 服务
  // 同时作为 gateway 新增的环境变量
  if (vncEnabled) {
    // 如果install.yaml在没有配置novnc的情况下，检查portal下是否有配置，都没有配置则使用默认novncClientImage
    const novncClientImage =
      config.novnc?.novncClientImage || config.portal?.novncClientImage || DEFAULT_NOVNC_CLIENT_IMAGE;

    addService("novnc", {
      image: novncClientImage,
      environment: {},
      ports: {},
      volumes: {},
    });
  }

  addService("notification", {
    image: scowImage,
    ports: {},
    environment: {
      SCOW_LAUNCH_APP: "notification",
      NEXT_PUBLIC_BASE_PATH: join(BASE_PATH, NOTIFICATION_PATH),
      MIS_SERVER_URL: "mis-server:5000",
      DB_PASSWORD: config.mis.dbPassword,
      AUTH_EXTERNAL_URL: config.auth.custom?.external?.url || join(BASE_PATH, "/auth"),
      AUTH_INTERNAL_URL: authUrl || "http://auth:5000",
      PUBLIC_PATH: join(BASE_PATH, publicPath),
      PROTOCOL: config.gateway.protocol,
      ...serviceLogEnv,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./config": "/etc/scow",
      "~/.ssh": "/root/.ssh",
    },
  });

  addService("resource", {
    image: scowImage,
    ports: {},
    environment: {
      SCOW_LAUNCH_APP: "resource",
      NEXT_PUBLIC_BASE_PATH: join(BASE_PATH, RESOURCE_PATH),
      MIS_SERVER_URL: "mis-server:5000",
      DB_PASSWORD: config.mis.dbPassword,
      AUTH_EXTERNAL_URL: config.auth.custom?.external?.url || join(BASE_PATH, "/auth"),
      AUTH_INTERNAL_URL: authUrl || "http://auth:5000",
      PUBLIC_PATH: join(BASE_PATH, publicPath),
      PROTOCOL: config.gateway.protocol,

      ADAPTER_SSL_ENABLED: String(config.adapter?.ssl?.enabled ?? false),
      ADAPTER_SSL_CA_CERT_PATH: adapterSslCaCertPath,
      ADAPTER_SSL_SCOW_CERT_PATH: adapterSslScowCertPath,
      ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: adapterSslScowPrivateKeyPath,

      ...serviceLogEnv,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
    },
    volumes: {
      "/etc/hosts": "/etc/hosts",
      "./config": "/etc/scow",
      "~/.ssh": "/root/.ssh",
    },
  });

  return composeSpec;
};
