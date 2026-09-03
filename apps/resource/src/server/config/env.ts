import { bool, envConfig, num, str } from "@scow/lib-config";

const specs = {
  LOG_LEVEL: str({
    default: "info",
    desc: "日志等级",
  }),
  LOG_PRETTY: bool({ desc: "以可读的方式输出log", default: false }),

  NEXT_PUBLIC_RUNTIME_BASE_PATH: str({ desc: "本服务路径", default: "/" }),

  MIS_SERVER_URL: str({ desc: "管理系统后端的路径", default: "mis-server:5000" }),

  AUTH_EXTERNAL_URL: str({ desc: "认证系统的URL。如果和本系统域名相同，可以只写完整路径", default: "/auth" }),

  AUTH_INTERNAL_URL: str({ desc: "认证服务内网地址", default: "http://auth:5000" }),

  MOCK_USER_ID: str({ desc: "开发和测试的时候所使用的user id", default: undefined }),

  PUBLIC_PATH: str({ desc: "SCOW公共文件的路径，需已包含SCOW的base path", default: "/public/" }),

  PROTOCOL: str({ desc: "scow 的访问协议，将影响 callbackUrl 的 protocol", default: "http" }),

  DB_PASSWORD: str({ desc: "管理系统数据库密码，将会覆写配置文件", default: undefined }),

  ADAPTER_SSL_ENABLED: bool({ desc: "到适配器的连接是否启动SSL", default: false }),
  ADAPTER_TIMEOUT_SECONDS: num({ desc: "调用调度器适配器的默认超时时间，单位秒", default: 60 }),
  ADAPTER_SSL_CA_CERT_PATH: str({ desc: "适配器 CA根证书路径", default: "./adapter/certs/ca.crt" }),
  ADAPTER_SSL_SCOW_CERT_PATH: str({ desc: "适配器 CA签名的 SCOW 证书路径", default: "./adapter/certs/scow.crt" }),
  ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: str({
    desc: "适配器 CA签名的 SCOW 私钥路径",
    default: "./adapter/certs/scow.key",
  }),
};

export const config = envConfig(specs);
