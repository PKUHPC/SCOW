import { bool, envConfig, host, num, port, str } from "@scow/lib-config";

export const config = envConfig({
  HOST: host({ default: "0.0.0.0", desc: "监听地址" }),
  PORT: port({ default: 5000, desc: "监听端口" }),
  LOG_LEVEL: str({
    default: "info",
    desc: "日志等级",
  }),
  LOG_PRETTY: bool({ desc: "以可读的方式输出log", default: false }),

  PORTAL_BASE_PATH: str({ desc: "门户系统base path", default: "/" }),

  MIS_SERVER_URL: str({ desc: "管理系统后端服务的路径", default: "mis-server:5000" }),

  DOWNLOAD_CHUNK_SIZE: num({ desc: "grpc下载文件时，每个message中的chunk的大小。单位字节", default: 3 * 1024 * 1024 }),

  SCOWD_SSL_ENABLED: bool({ desc: "到 SCOWD 的连接是否启动SSL", default: false }),
  SCOWD_SSL_CA_CERT_PATH: str({ desc: "SCOWD CA根证书路径", default: "./scowd/certs/ca.crt" }),
  SCOWD_SSL_SCOW_CERT_PATH: str({ desc: "SCOWD CA签名的 SCOW 证书路径", default: "./scowd/certs/scow.crt" }),
  SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: str({ desc: "SCOWD CA签名的 SCOW 私钥路径", default: "./scowd/certs/scow.key" }),

  ADAPTER_SSL_ENABLED: bool({ desc: "到适配器的连接是否启动SSL", default: false }),
  ADAPTER_TIMEOUT_SECONDS: num({ desc: "调用调度器适配器的默认超时时间，单位秒", default: 60 }),
  ADAPTER_SSL_CA_CERT_PATH: str({ desc: "适配器 CA根证书路径", default: "./adapter/certs/ca.crt" }),
  ADAPTER_SSL_SCOW_CERT_PATH: str({ desc: "适配器 CA签名的 SCOW 证书路径", default: "./adapter/certs/scow.crt" }),
  ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: str({
    desc: "适配器 CA签名的 SCOW 私钥路径",
    default: "./adapter/certs/scow.key",
  }),
});
