import { readVersionFile } from "@scow/utils/build/version";
import { createServer, IncomingMessage, request as httpRequest, ServerResponse } from "http";
import { request as httpsRequest } from "https";
import { Socket } from "net";
import { config } from "src/env";
import { URL } from "url";

interface ProxyRoute {
  prefix: string;
  target: string;
  stripPrefix?: boolean;
}

function joinPath(...segments: string[]) {
  const result = segments
    .filter((x) => x !== "")
    .join("/")
    .replace(/\/+/g, "/");
  return result === "" ? "/" : result;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function route(prefix: string, target: string, options: Pick<ProxyRoute, "stripPrefix"> = {}): ProxyRoute {
  const normalizedPrefix = prefix === "/" ? "/" : trimTrailingSlash(prefix);
  return { prefix: normalizedPrefix, target, ...options, stripPrefix: normalizedPrefix !== "/" && options.stripPrefix };
}

function matches(pathname: string, prefix: string) {
  return prefix === "/" || pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getUpstreamUrl(requestUrl: string | undefined, proxyRoute: ProxyRoute) {
  const target = new URL(proxyRoute.target);
  const originalUrl = new URL(requestUrl ?? "/", "http://localhost");
  const strippedPath = originalUrl.pathname.substring(proxyRoute.prefix.length) || "/";

  target.pathname = proxyRoute.stripPrefix ? joinPath(target.pathname, strippedPath) : originalUrl.pathname;
  target.search = originalUrl.search;

  return target;
}

function getRoutes(): ProxyRoute[] {
  const basePath = config.BASE_PATH;
  const routes = [
    route(joinPath(basePath, "/auth/public"), `${trimTrailingSlash(config.AUTH_URL)}/public`, { stripPrefix: true }),
    route(joinPath(basePath, config.NOTIFICATION_PATH), config.NOTIFICATION_PATH_INTERNAL_URL, { stripPrefix: true }),
    route(joinPath(basePath, config.RESOURCE_PATH), config.RESOURCE_PATH_INTERNAL_URL, { stripPrefix: true }),
  ];

  if (config.META_SERVER_ENABLED) {
    routes.unshift(route(joinPath(basePath, "/meta"), config.META_SERVER_URL));
  }

  if (config.UNIFIED_WEB_ENABLED) {
    if (config.PORTAL_ENABLED) {
      routes.push(
        route(
          joinPath(basePath, "/api/unified/portal"),
          `${trimTrailingSlash(config.PORTAL_PATH_INTERNAL_URL)}${joinPath(basePath, config.PORTAL_PATH, "/api")}`,
          { stripPrefix: true },
        ),
      );
    }
    routes.push(
      route(
        joinPath(basePath, "/api/unified/mis"),
        `${trimTrailingSlash(config.MIS_PATH_INTERNAL_URL)}${joinPath(basePath, config.MIS_PATH, "/api")}`,
        { stripPrefix: true },
      ),
    );
    if (config.AI_ENABLED) {
      routes.push(
        route(
          joinPath(basePath, "/api/unified/ai"),
          `${trimTrailingSlash(config.AI_PATH_INTERNAL_URL)}${joinPath(basePath, config.AI_PATH, "/api")}`,
          { stripPrefix: true },
        ),
      );
    }
    routes.push(
      route(
        joinPath(basePath, "/api/unified/notification"),
        `${trimTrailingSlash(config.NOTIFICATION_PATH_INTERNAL_URL)}${joinPath(basePath, config.NOTIFICATION_PATH, "/api")}`,
        { stripPrefix: true },
      ),
    );
    if (config.QUANTUM_ENABLED) {
      routes.push(
        route(
          joinPath(basePath, "/api/unified/quantum"),
          `${trimTrailingSlash(config.QUANTUM_PATH_INTERNAL_URL)}${joinPath(basePath, config.QUANTUM_PATH, "/api")}`,
          { stripPrefix: true },
        ),
      );
    }
  }

  if (config.PORTAL_ENABLED) {
    routes.push(route(joinPath(basePath, config.PORTAL_PATH), config.PORTAL_PATH_INTERNAL_URL, { stripPrefix: true }));
  }
  routes.push(route(joinPath(basePath, config.MIS_PATH), config.MIS_PATH_INTERNAL_URL, { stripPrefix: true }));
  if (config.AI_ENABLED) {
    routes.push(route(joinPath(basePath, config.AI_PATH), config.AI_PATH_INTERNAL_URL, { stripPrefix: true }));
  }
  if (config.QUANTUM_ENABLED) {
    routes.push(
      route(joinPath(basePath, config.QUANTUM_PATH), config.QUANTUM_PATH_INTERNAL_URL, { stripPrefix: true }),
    );
  }
  if (config.VNC_ENABLED) {
    routes.push(route(joinPath(basePath, config.VNC_PATH), config.NOVNC_INTERNAL_URL, { stripPrefix: true }));
  }

  return routes.sort((a, b) => b.prefix.length - a.prefix.length);
}

function proxyRequest(req: IncomingMessage, res: ServerResponse) {
  const proxyRoute = findRoute(req.url);
  if (!proxyRoute) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Not Found" }));
    return;
  }

  const upstreamUrl = getUpstreamUrl(req.url, proxyRoute);
  const headers = { ...req.headers };
  headers.host = upstreamUrl.host;
  headers["x-forwarded-host"] = req.headers.host ?? "";
  headers["x-forwarded-proto"] = "http";
  headers["x-forwarded-port"] = String(req.socket.localPort ?? "");

  const proxyReq = (upstreamUrl.protocol === "https:" ? httpsRequest : httpRequest)(
    upstreamUrl,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", (error) => {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "Bad Gateway", error: error.message }));
  });

  req.pipe(proxyReq);
}

function proxyUpgrade(req: IncomingMessage, socket: Socket, head: Buffer) {
  const proxyRoute = findRoute(req.url);
  if (!proxyRoute) {
    socket.destroy();
    return;
  }

  const upstreamUrl = getUpstreamUrl(req.url, proxyRoute);
  const headers = { ...req.headers, host: upstreamUrl.host };
  const proxyReq = (upstreamUrl.protocol === "https:" ? httpsRequest : httpRequest)(upstreamUrl, {
    method: req.method,
    headers,
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/${proxyRes.httpVersion} ${proxyRes.statusCode} ${proxyRes.statusMessage}\r\n` +
        Object.entries(proxyRes.headers)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
          .join("\r\n") +
        "\r\n\r\n",
    );
    proxySocket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", () => socket.destroy());
  proxyReq.end(head);
}

const routes = getRoutes();
const findRoute = (url: string | undefined) => {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  return routes.find((x) => matches(pathname, x.prefix));
};

console.log("@scow/gateway dev proxy: ", readVersionFile());

const server = createServer(proxyRequest);
server.on("upgrade", proxyUpgrade);
server.listen(config.PORT, "0.0.0.0", () => {
  console.log("gateway dev proxy listening on port %d", config.PORT);
});
