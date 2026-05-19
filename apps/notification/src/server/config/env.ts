import { bool, envConfig, str } from "@scow/lib-config";

const specs = {
  LOG_LEVEL: str({
    default: "info",
    desc: "日志等级",
  }),
  LOG_PRETTY: bool({ desc: "以可读的方式输出log", default: false }),

  NEXT_PUBLIC_RUNTIME_BASE_PATH: str({ desc: "本服务路径", default: "/" }),

  MIS_SERVER_URL: str({ desc: "如果部署了管理系统，管理系统后端的路径", default: "" }),

  AUTH_EXTERNAL_URL: str({ desc: "认证系统的URL。如果和本系统域名相同，可以只写完整路径", default: "/auth" }),

  AUTH_INTERNAL_URL: str({ desc: "认证服务内网地址", default: "http://auth:5000" }),

  MOCK_USER_ID: str({ desc: "开发和测试的时候所使用的user id", default: undefined }),

  PUBLIC_PATH: str({ desc: "SCOW公共文件的路径，需已包含SCOW的base path", default: "/public/" }),

  PROTOCOL: str({ desc: "scow 的访问协议，将影响 callbackUrl 的 protocol", default: "http" }),

  DB_PASSWORD: str({ desc: "管理系统数据库密码，将会覆写配置文件", default: undefined }),
};

export const config = envConfig(specs);
