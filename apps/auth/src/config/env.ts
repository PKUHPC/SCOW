import { bool, envConfig, host, port, str } from "@scow/lib-config";
import { getKeyPair } from "@scow/lib-ssh";
import { homedir } from "os";
import { join } from "path";

import { AuthType } from "./AuthType";

export const FAVICON_URL = "/api/icon?type=favicon";

export const LOGO_URL = "/api/logo?type=login&preferDark=";

export const config = envConfig({
  HOST: host({ default: "0.0.0.0", desc: "监听地址" }),
  PORT: port({ default: 5000, desc: "监听端口" }),
  LOG_LEVEL: str({
    default: "info",
    desc: "日志等级",
  }),
  LOG_PRETTY: bool({ desc: "以可读的方式输出log", default: false }),

  BASE_PATH: str({ desc: "整个系统的base path", default: "/" }),

  AUTH_BASE_PATH: str({ desc: "认证系统相对于整个系统的base path", default: "/auth" }),

  AUTH_TYPE: str({ desc: "认证类型。将会覆写配置文件", choices: Object.values(AuthType), default: undefined }),

  MOCK_USERS: str({
    desc: "模仿用户，如果这些用户登录，将其ID改为另一个ID。格式：原用户ID=新用户ID,原用户ID=新用户ID。将会和配置文件mockUsers对象合并",
    default: "",
  }),
  SSH_PRIVATE_KEY_PATH: str({ desc: "SSH私钥路径", default: join(homedir(), ".ssh", "id_rsa") }),
  SSH_PUBLIC_KEY_PATH: str({ desc: "SSH公钥路径", default: join(homedir(), ".ssh", "id_rsa.pub") }),

  EXTRA_ALLOWED_CALLBACK_HOSTNAMES: str({ desc: "额外的信任回调域名，以逗号分隔", default: "" }),

  PUBLIC_PATH: str({ desc: "静态文件路径前缀。以/开头，以/结尾", default: "/__public__/" }),

  DEFAULT_SETUP_HOME_PATH: str({ desc: "默认SCOW已启动服务路径，用于logo等静态资源链接构建", default: "/" }),
});

export const rootKeyPair = getKeyPair(config.SSH_PRIVATE_KEY_PATH, config.SSH_PUBLIC_KEY_PATH);
