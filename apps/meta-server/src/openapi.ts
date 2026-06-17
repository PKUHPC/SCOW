import { InstallConfigSchema } from "@scow/config/build/install";
import path from "path";

import { getScowctlPagePath } from "./scowctl";

type JsonObject = Record<string, any>;

export interface OpenApiSource {
  name: string;
  systemBasePath: string;
  publicBasePath: string;
  internalUrl: string;
}

export interface OpenApiSourceStatus {
  name: string;
  url: string;
  ok: boolean;
  error?: string;
}

const defaultInternalUrls = {
  portal: "http://portal-web:3000",
  mis: "http://mis-web:3000",
  ai: "http://ai:3000",
  quantum: "http://quantum:3000",
  notification: "http://notification:3000",
  resource: "http://resource:3000",
} as const;

export type OpenApiInternalUrlOverrides = Partial<Record<keyof typeof defaultInternalUrls, string>>;

function joinPath(...segments: string[]) {
  const result = path.posix.normalize(path.posix.join(...segments));
  return result === "/" ? result : result.replace(/\/$/, "");
}

function joinUrl(base: string, ...segments: string[]) {
  const url = new URL(base);
  url.pathname = joinPath(url.pathname, ...segments);
  return url.toString();
}

function getComponentBasePath(systemBasePath: string, componentBasePath: string) {
  return joinPath(systemBasePath === "/" ? "" : systemBasePath, componentBasePath);
}

function createSource(
  name: keyof typeof defaultInternalUrls,
  config: InstallConfigSchema,
  componentBasePath: string,
  internalUrlOverrides: OpenApiInternalUrlOverrides = {},
) {
  const publicBasePath = getComponentBasePath(config.basePath, componentBasePath);
  const internalUrl = internalUrlOverrides[name]?.trim();
  return {
    name,
    systemBasePath: config.basePath,
    publicBasePath,
    internalUrl: internalUrl || joinUrl(defaultInternalUrls[name], publicBasePath, "/api/openapi.json"),
  };
}

export function getOpenApiSources(
  config: InstallConfigSchema,
  internalUrlOverrides: OpenApiInternalUrlOverrides = {},
): OpenApiSource[] {
  return [
    ...(config.portal?.enabled ? [createSource("portal", config, config.portal.basePath, internalUrlOverrides)] : []),
    ...(config.mis?.enabled ? [createSource("mis", config, config.mis.basePath, internalUrlOverrides)] : []),
    ...(config.ai?.enabled ? [createSource("ai", config, config.ai.basePath, internalUrlOverrides)] : []),
    ...(config.quantum?.enabled
      ? [createSource("quantum", config, config.quantum.basePath, internalUrlOverrides)]
      : []),
    ...(config.notification
      ? [createSource("notification", config, config.notification.basePath, internalUrlOverrides)]
      : []),
    ...(config.resource ? [createSource("resource", config, config.resource.basePath, internalUrlOverrides)] : []),
  ];
}

function prefixComponentRef(value: unknown, sourceName: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => prefixComponentRef(item, sourceName));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: JsonObject = {};

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string" && child.startsWith("#/components/")) {
      result[key] = child.replace(/^#\/components\/([^/]+)\//, `#/components/$1/${sourceName}_`);
    } else {
      result[key] = prefixComponentRef(child, sourceName);
    }
  }

  return result;
}

function mergeComponents(target: JsonObject, source: JsonObject, sourceName: string) {
  for (const [componentType, components] of Object.entries(source)) {
    if (!components || typeof components !== "object" || Array.isArray(components)) {
      continue;
    }

    target[componentType] ??= {};

    for (const [name, value] of Object.entries(components)) {
      target[componentType][`${sourceName}_${name}`] = prefixComponentRef(value, sourceName);
    }
  }
}

function prefixPaths(spec: JsonObject, publicBasePath: string, sourceName: string) {
  const paths: JsonObject = {};
  const serverPath =
    typeof spec.servers?.[0]?.url === "string" ? (new URL(spec.servers[0].url, "http://localhost").pathname ?? "") : "";
  const pathPrefix = serverPath && serverPath !== "/" ? serverPath : publicBasePath;

  for (const [apiPath, item] of Object.entries(spec.paths ?? {})) {
    const fullPath = joinPath(pathPrefix, apiPath);
    paths[fullPath] = prefixComponentRef(item, sourceName);
  }

  return paths;
}

function createDescription(sources: OpenApiSource[]) {
  const systemBasePath = sources[0]?.systemBasePath ?? "/";

  return [
    "Unified OpenAPI document for enabled SCOW components.",
    "",
    `Use [scowctl](${getScowctlPagePath(systemBasePath)}) to install the SCOW command line tool and call these APIs.`,
  ].join("\n");
}

async function fetchOpenApiSource(source: OpenApiSource) {
  const response = await fetch(source.internalUrl);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as JsonObject;
}

export async function createMergedOpenApiDocument(sources: OpenApiSource[]) {
  const paths: JsonObject = {};
  const components: JsonObject = {};
  const sourceStatuses: OpenApiSourceStatus[] = [];

  for (const source of sources) {
    try {
      const spec = await fetchOpenApiSource(source);

      Object.assign(paths, prefixPaths(spec, source.publicBasePath, source.name));
      mergeComponents(components, spec.components ?? {}, source.name);

      sourceStatuses.push({ name: source.name, url: source.internalUrl, ok: true });
    } catch (error) {
      sourceStatuses.push({
        name: source.name,
        url: source.internalUrl,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "SCOW API",
      description: createDescription(sources),
      version: "1.0.0",
    },
    paths,
    components,
    "x-scow-sources": sourceStatuses,
  };
}
