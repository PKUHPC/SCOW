import { bool, envConfig, host, port, str } from "@scow/lib-config";

export const config = envConfig({
  HOST: host({ default: "0.0.0.0", desc: "监听地址" }),
  PORT: port({ default: 5000, desc: "监听端口" }),
  LOG_LEVEL: str({
    default: "info",
    desc: "日志等级",
  }),
  LOG_PRETTY: bool({ desc: "以可读的方式输出log", default: false }),

  DB_NAME: str({ desc: "存放系统数据的数据库名，将会覆写配置文件。用于测试", default: undefined }),
  DB_PASSWORD: str({ desc: "审计系统数据库密码，将会覆写配置文件", default: undefined }),
});
