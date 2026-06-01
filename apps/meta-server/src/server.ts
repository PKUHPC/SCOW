import { getInstallConfig } from "@scow/config/build/install";
import fastify from "fastify";

import { getMetadata } from "./metadata";
import { createMergedOpenApiDocument, getOpenApiSources } from "./openapi";
import { createOpenApiHtml, sendSwaggerUiAsset } from "./openapiUi";
import { META_BASE_PATH, metaBasePath } from "./paths";
import {
  createScowctlHtml,
  createScowctlInstallScript,
  createScowctlPowerShellInstallScript,
  sendScowctlBinary,
} from "./scowctl";

function getScowBaseUrl(request: { headers: Record<string, string | string[] | undefined> }) {
  const forwardedProto = firstHeader(request.headers["x-forwarded-proto"]);
  const proto = forwardedProto ?? "http";
  const host =
    firstHeader(request.headers["x-forwarded-host"]) ??
    firstHeader(request.headers.host) ??
    `localhost`;
  return `${proto}://${host}`;
}

function firstHeader(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function stripBasePath(pathname: string, basePath: string) {
  if (basePath === "/") {
    return pathname;
  }

  if (pathname === basePath) {
    return "/";
  }

  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.substring(basePath.length);
  }

  return pathname;
}

export function stripMetaBasePath(pathname: string) {
  if (pathname === META_BASE_PATH) {
    return "/";
  }

  if (pathname.startsWith(`${META_BASE_PATH}/`)) {
    return pathname.substring(META_BASE_PATH.length);
  }

  return pathname;
}

export function createMetaServer(installConfigPath: string) {
  const installConfig = getInstallConfig(installConfigPath);
  const server = fastify({ logger: false, ignoreTrailingSlash: true });
  const metadataRootPath = metaBasePath(installConfig.basePath);

  server.get(metadataRootPath, async () => getMetadata(installConfig));

  server.get(`${metadataRootPath}/openapi`, async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(createOpenApiHtml(installConfig.basePath));
  });

  server.get(`${metadataRootPath}/openapi/*`, async (request, reply) => {
    const params = request.params as { "*": string };
    return sendSwaggerUiAsset(reply, params["*"]);
  });

  server.get(`${metadataRootPath}/api/openapi.json`, async () => {
    const sources = getOpenApiSources(installConfig);
    return createMergedOpenApiDocument(sources);
  });

  server.get(`${metadataRootPath}/scowctl`, async (request, reply) => {
    const scowBaseUrl = getScowBaseUrl(request);
    return reply.type("text/html; charset=utf-8").send(createScowctlHtml(installConfig.basePath, scowBaseUrl));
  });

  server.get(`${metadataRootPath}/scowctl/install.sh`, async (request, reply) => {
    const scowBaseUrl = getScowBaseUrl(request);
    return reply.type("text/plain; charset=utf-8").send(createScowctlInstallScript(installConfig.basePath, scowBaseUrl));
  });

  server.get(`${metadataRootPath}/scowctl/install.ps1`, async (request, reply) => {
    const scowBaseUrl = getScowBaseUrl(request);
    return reply
      .type("text/plain; charset=utf-8")
      .send(createScowctlPowerShellInstallScript(installConfig.basePath, scowBaseUrl));
  });

  server.get(`${metadataRootPath}/scowctl/bin/:binaryName`, async (request, reply) => {
    const params = request.params as { binaryName: string };
    return sendScowctlBinary(reply, params.binaryName);
  });

  server.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ message: "Not Found" });
  });

  return server;
}
