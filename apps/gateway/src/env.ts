import { bool, envConfig, port, str } from "@scow/lib-config";

export const config = envConfig({
  PORT: port({ desc: "HTTP 服务监听端口，仅 Node dev proxy 使用", default: 80 }),

  RESOLVER: str({ desc: "DNS地址", default: "127.0.0.11" }),

  CLIENT_MAX_BODY_SIZE: str({ desc: "请求文件大小限制", default: "1G" }),
  PROXY_READ_TIMEOUT: str({ desc: "应用到server块的proxy_read_timeout", default: "60s" }),

  BASE_PATH: str({ desc: "base path", default: "" }),

  UNIFIED_WEB_ENABLED: bool({ desc: "是否启用统一前端预览入口", default: false }),
  UNIFIED_WEB_PATH: str({ desc: "统一前端预览路径", default: "/unified" }),
  UNIFIED_WEB_SOURCE_DIR: str({
    desc: "统一前端构建产物目录",
    default: "/app/apps/unified-web/dist",
  }),
  UNIFIED_WEB_RUNTIME_ROOT: str({
    desc: "替换运行时路径后的统一前端静态文件根目录",
    default: "/tmp/scow-unified-web",
  }),

  PORTAL_ENABLED: bool({ desc: "是否启用门户系统", default: true }),
  PORTAL_PATH: str({ desc: "门户系统路径", default: "/" }),
  PORTAL_PATH_INTERNAL_URL: str({ desc: "门户系统内部路径", default: "http://portal-web:3000" }),

  MIS_PATH: str({ desc: "管理系统路径", default: "/mis" }),
  MIS_PATH_INTERNAL_URL: str({ desc: "管理系统内部路径", default: "http://mis-web:3000" }),

  AI_ENABLED: bool({ desc: "是否启用AI系统", default: true }),
  AI_PATH: str({ desc: "AI系统路径", default: "/ai" }),
  AI_PATH_INTERNAL_URL: str({ desc: "AI系统内部路径", default: "http://ai:3000" }),

  NOTIFICATION_PATH: str({ desc: "消息系统路径", default: "/notification" }),
  NOTIFICATION_PATH_INTERNAL_URL: str({ desc: "消息系统内部路径", default: "http://notification:3000" }),

  RESOURCE_PATH: str({ desc: "资源管理系统路径", default: "/resource" }),
  RESOURCE_PATH_INTERNAL_URL: str({ desc: "资源管理系统内部路径", default: "http://resource:3000" }),

  QUANTUM_ENABLED: bool({ desc: "是否启用量子计算系统", default: true }),
  QUANTUM_PATH: str({ desc: "量子计算系统路径", default: "/quantum" }),
  QUANTUM_PATH_INTERNAL_URL: str({ desc: "量子计算系统内部路径", default: "http://quantum:3000" }),

  // 根据启动的子系统是否包含 AI 或 portal 推算
  VNC_ENABLED: bool({ desc: "是否启用VNC代理", default: false }),
  VNC_PATH: str({ desc: "VNC客户端路径", default: "/vnc/" }),
  NOVNC_INTERNAL_URL: str({ desc: "NOVNC内部地址", default: "http://novnc:80/" }),

  AUTH_URL: str({ desc: "认证服务地址", default: "http://auth:5000" }),

  META_SERVER_URL: str({ desc: "元数据服务地址", default: "http://meta-server:3000" }),

  EXTRA: str({ desc: "更多nginx配置", default: "" }),

  PUBLIC_DIR: str({ desc: "静态文件在文件系统中的路径。以/结尾", default: "/app/apps/gateway/public/" }),
  PUBLIC_PATH: str({ desc: "静态文件路径前缀。以/开头，以/结尾", default: "/__public__/" }),

  ALLOWED_SERVER_NAME: str({ desc: "允许访问的域名或 IP，多个域名和 IP 间用空格隔开", default: "_" }),
  DEFAULT_SERVER_BLOCK: str({
    desc: "当配置了ALLOWED_SERVER_NAME为特定IP或域名时，设置默认服务块拒绝其他访问",
    default: "",
  }),
});
