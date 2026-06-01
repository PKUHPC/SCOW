import { envConfig, port, str } from "@scow/lib-config";

export const config = envConfig({
  PORT: port({ desc: "HTTP 服务监听端口", default: 3000 }),
  INSTALL_CONFIG_PATH: str({ desc: "install.yaml 路径", default: "/etc/scow/install.yaml" }),
});
