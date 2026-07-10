import { bool, envConfig, str } from "@scow/lib-config";

export const config = envConfig({
  DB_PASSWORD: str({ desc: "数据库密码，如果非空会覆盖配置文件", default: "" }),

  NEXT_PUBLIC_RUNTIME_BASE_PATH: str({ desc: "本服务路径", default: "/" }),

  PORTAL_URL: str({
    desc: "HPC门户系统的URL。如果和本系统域名相同，可以只写完整的路径。将会覆盖配置文件",
    default: "",
  }),
  PORTAL_INTERNAL_URL: str({
    desc: "服务端访问portal-web服务的URL，需为包含http(s)协议的绝对URL",
    default: "",
  }),
  PORTAL_SERVER_URL: str({ desc: "HPC门户系统后端服务的路径", default: "" }),

  MIS_URL: str({ desc: "管理系统的URL。如果和本系统域名相同，可以只写完整的路径。将会覆盖配置文件", default: "" }),
  MIS_SERVER_URL: str({ desc: "管理系统后端服务的路径", default: "" }),

  AI_DEPLOYED: bool({ desc: "是否部署了AI系统", default: false }),
  AI_URL: str({
    desc: "如果部署了AI系统，AI系统的URL。如果和本系统域名相同，可以只写完整路径。将会覆盖配置文件。空字符串等价于未部署AI系统",
    default: "",
  }),

  AUTH_EXTERNAL_URL: str({ desc: "认证系统的URL。如果和本系统域名相同，可以只写完整路径", default: "/auth" }),

  AUTH_INTERNAL_URL: str({ desc: "认证系统的内部URL", default: "http://auth:5000" }),

  PROTOCOL: str({ desc: "scow 的访问协议，将影响 callbackUrl 的 protocol", default: "http" }),

  ADAPTER_SSL_ENABLED: bool({ desc: "到适配器的连接是否启动SSL", default: false }),
  ADAPTER_SSL_CA_CERT_PATH: str({ desc: "适配器 CA根证书路径", default: "./adapter/certs/ca.crt" }),
  ADAPTER_SSL_SCOW_CERT_PATH: str({ desc: "适配器 CA签名的 SCOW 证书路径", default: "./adapter/certs/scow.crt" }),
  ADAPTER_SSL_SCOW_PRIVATE_KEY_PATH: str({
    desc: "适配器 CA签名的 SCOW 私钥路径",
    default: "./adapter/certs/scow.key",
  }),
});
