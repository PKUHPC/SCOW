import { bool, envConfig, num, str } from "@scow/lib-config";

const specs = {
  LOG_LEVEL: str({
    default: "info",
    desc: "日志等级",
  }),
  LOG_PRETTY: bool({ desc: "以可读的方式输出log", default: false }),

  NEXT_PUBLIC_RUNTIME_BASE_PATH: str({ desc: "本服务路径", default: "/" }),

  AUTH_EXTERNAL_URL: str({ desc: "认证系统的URL。如果和本系统域名相同，可以只写完整路径", default: "/auth" }),

  AUTH_INTERNAL_URL: str({ desc: "认证服务内网地址", default: "http://auth:5000" }),

  LOGIN_NODES: str({ desc: "集群的登录节点。将会覆写配置文件。格式：集群ID=登录节点,集群ID=登录节点", default: "" }),

  MOCK_USER_ID: str({ desc: "开发和测试的时候所使用的user id", default: undefined }),

  PORTAL_DEPLOYED: bool({ desc: "是否部署了管理系统", default: false }),
  PORTAL_URL: str({
    desc: "如果部署了HPC门户系统，HPC门户系统的URL。如果和本系统域名相同，可以只写完整的路径。将会覆盖配置文件。空字符串等价于未部署HPC门户系统",
    default: "",
  }),

  MIS_DEPLOYED: bool({ desc: "是否部署了管理系统", default: false }),
  MIS_URL: str({
    desc: "如果部署了管理系统，管理系统的URL。如果和本系统域名相同，可以只写完整的路径。将会覆盖配置文件。空字符串等价于未部署管理系统",
    default: "",
  }),
  MIS_SERVER_URL: str({ desc: "如果部署了管理系统，管理系统后端服务的路径", default: "" }),

  QUANTUM_DEPLOYED: bool({ desc: "是否部署了量子系统", default: false }),
  QUANTUM_URL: str({
    desc: "如果部署了量子系统，量子系统的URL。如果和本系统域名相同，可以只写完整路径。将会覆盖配置文件。空字符串等价于未部署量子系统",
    default: "",
  }),

  CLIENT_MAX_BODY_SIZE: str({
    desc: "限制整个系统上传（请求）文件的大小，可接受的格式为nginx的client_max_body_size可接受的值",
    default: "1G",
  }),

  PUBLIC_PATH: str({ desc: "SCOW公共文件的路径，需已包含SCOW的base path", default: "/public/" }),

  AUDIT_DEPLOYED: bool({ desc: "是否部署了审计系统", default: false }),

  PROTOCOL: str({ desc: "scow 的访问协议，将影响 callbackUrl 的 protocol", default: "http" }),

  DB_PASSWORD: str({ desc: "管理系统数据库密码，将会覆写配置文件", default: undefined }),

  DOWNLOAD_CHUNK_SIZE: num({ desc: "下载文件时，每个message中的chunk的大小。单位字节", default: 3 * 1024 * 1024 }),

  NOVNC_CLIENT_URL: str({ desc: "novnc客户端的URL。如果和本系统域名相同，可以只写完整路径", default: "/vnc" }),

  ADAPTER_SSL_ENABLED: bool({ desc: "到适配器的连接是否启动SSL", default: false }),
  ADAPTER_SSL_CA_CERT_PATH: str({ desc: "适配器 CA根证书路径", default: "./adapter/certs/ca.crt" }),
  ADAPTER_SSL_SCOW_CERT_PATH: str({ desc: "适配器 CA签名的 SCOW 证书路径", default: "./adapter/certs/scow.crt" }),
  ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: str({
    desc: "适配器 CA签名的 SCOW 私钥路径",
    default: "./adapter/certs/scow.key",
  }),

  SCOWD_SSL_ENABLED: bool({ desc: "到 SCOWD 的连接是否启动SSL", default: false }),
  SCOWD_SSL_CA_CERT_PATH: str({ desc: "SCOWD CA根证书路径", default: "./scowd/certs/ca.crt" }),
  SCOWD_SSL_SCOW_CERT_PATH: str({ desc: "SCOWD CA签名的 SCOW 证书路径", default: "./scowd/certs/scow.crt" }),
  SCOWD_SSL_SCOW_PRIVATE_KEY_PATH: str({ desc: "SCOWD CA签名的 SCOW 私钥路径", default: "./scowd/certs/scow.key" }),
};

export const config = envConfig(specs);
