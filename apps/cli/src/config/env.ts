import { bool, envConfig, str } from "@scow/lib-config";

export const config = envConfig({
  LOG_LEVEL: str({ desc: "日志等级", default: "info" }),
  LOG_SHOW_TIMESTAMP: bool({ desc: "日志显示时间戳", default: false }),

  HTTPS_PROXY: str({ desc: "https代理，优先级1", default: undefined }),
  https_proxy: str({ desc: "https代理，优先级2", default: undefined }),
  HTTP_PROXY: str({ desc: "https代理，优先级3", default: undefined }),
  http_proxy: str({ desc: "https代理，优先级4", default: undefined }),

  PLUGINS_DIR: str({ desc: "插件目录", default: "plugins" }),
});
