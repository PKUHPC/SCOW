import react from "@vitejs/plugin-react";
import { DEV_GATEWAY_PROXY_PREFIX } from "./src/config/devGatewayProxy";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

const rewriteAuthCallbackOrigin = (location: string, host: string) => {
  const redirectUrl = new URL(location, "http://gateway.invalid");
  const callbackUrlText = redirectUrl.searchParams.get("callbackUrl");
  if (!callbackUrlText) return location;

  const callbackUrl = new URL(callbackUrlText);
  callbackUrl.protocol = "http:";
  callbackUrl.host = host;
  redirectUrl.searchParams.set("callbackUrl", callbackUrl.toString());

  return location.startsWith("http://") || location.startsWith("https://")
    ? redirectUrl.toString()
    : `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
};

const createGatewayProxy = (target: string, { ws = false, rewriteAuthCallback = false } = {}): ProxyOptions => ({
  target,
  ws,
  changeOrigin: true,
  configure(proxy) {
    if (!rewriteAuthCallback) return;

    proxy.on("proxyRes", (proxyResponse, request) => {
      const location = proxyResponse.headers.location;
      const host = request.headers.host;
      if (!location || !host) return;

      try {
        proxyResponse.headers.location = rewriteAuthCallbackOrigin(location, host);
      } catch {
        return;
      }
    });
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gatewayUrl = env.VITE_GATEWAY_URL || "http://localhost:80";

  return {
    base: command === "build" ? "/@UNIFIED_BASE_PATH@/" : "/",
    plugins: [react()],
    resolve: {
      alias: {
        src: new URL("./src", import.meta.url).pathname,
      },
    },
    optimizeDeps: {
      include: [
        "@scow/config/build/i18n",
        "@scow/lib-web/build/components/quickEntry",
        "@scow/notification-protos/build/common_pb",
        "@scow/notification-protos/build/message_pb",
        "@scow/notification-protos/build/notice_type_pb",
        "@scow/notification-protos/build/user_subscription_pb",
      ],
    },
    server: {
      port: 3000,
      proxy: {
        "/api": createGatewayProxy(gatewayUrl, { rewriteAuthCallback: true }),
        "/auth": createGatewayProxy(gatewayUrl),
        "/meta": createGatewayProxy(gatewayUrl),
        "/vnc": createGatewayProxy(gatewayUrl, { ws: true }),
        [DEV_GATEWAY_PROXY_PREFIX]: {
          ...createGatewayProxy(gatewayUrl),
          rewrite: (path) => path.slice(DEV_GATEWAY_PROXY_PREFIX.length) || "/",
        },
      },
    },
  };
});
