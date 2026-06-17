import { envConfig, port, str } from "@scow/lib-config";

export const config = envConfig({
  PORT: port({ desc: "HTTP 服务监听端口", default: 3000 }),
  INSTALL_CONFIG_PATH: str({ desc: "install.yaml 路径", default: "/etc/scow/install.yaml" }),
  PORTAL_OPENAPI_INTERNAL_URL: str({ desc: "门户系统 OpenAPI JSON 内部地址覆盖", default: "" }),
  MIS_OPENAPI_INTERNAL_URL: str({ desc: "管理系统 OpenAPI JSON 内部地址覆盖", default: "" }),
  AI_OPENAPI_INTERNAL_URL: str({ desc: "AI 系统 OpenAPI JSON 内部地址覆盖", default: "" }),
  QUANTUM_OPENAPI_INTERNAL_URL: str({ desc: "量子系统 OpenAPI JSON 内部地址覆盖", default: "" }),
  NOTIFICATION_OPENAPI_INTERNAL_URL: str({ desc: "消息系统 OpenAPI JSON 内部地址覆盖", default: "" }),
  RESOURCE_OPENAPI_INTERNAL_URL: str({ desc: "资源管理系统 OpenAPI JSON 内部地址覆盖", default: "" }),
});

export function getOpenApiInternalUrlOverrides() {
  return {
    portal: config.PORTAL_OPENAPI_INTERNAL_URL,
    mis: config.MIS_OPENAPI_INTERNAL_URL,
    ai: config.AI_OPENAPI_INTERNAL_URL,
    quantum: config.QUANTUM_OPENAPI_INTERNAL_URL,
    notification: config.NOTIFICATION_OPENAPI_INTERNAL_URL,
    resource: config.RESOURCE_OPENAPI_INTERNAL_URL,
  };
}
