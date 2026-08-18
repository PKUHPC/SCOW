import type {
  UiExtensionApi,
  UiExtensionConfigEntry,
  UiExtensionInstallation,
  UiExtensionRequestContext,
  UiExtensionSource,
} from "src/features/uiExtension/types";

import { createRestClient } from "src/api/http";
import { getDevGatewayResourceUrl } from "src/config/devGatewayProxy";
import { joinExtensionUrl } from "src/features/uiExtension/paths";
import {
  aiExtensionConfigResponseSchema,
  navbarLinksResponseSchema,
  portalExtensionConfigResponseSchema,
  rewriteNavigationsResponseSchema,
  uiExtensionManifestSchema,
} from "src/features/uiExtension/schemas";
import { z } from "zod";

const portalClient = createRestClient("portal");
const aiClient = createRestClient("ai");

const getExtensionRequestUrl = (url: string) =>
  import.meta.env.DEV && import.meta.env.VITE_GATEWAY_URL
    ? getDevGatewayResourceUrl(url, import.meta.env.VITE_GATEWAY_URL)
    : url;

interface SourceConfig {
  source: UiExtensionSource;
  entries: UiExtensionConfigEntry[];
}

const normalizeConfig = (config: { url: string } | { name: string; url: string }[] | undefined) =>
  !config ? [] : Array.isArray(config) ? config : [config];

const getSourceConfig = async (source: UiExtensionSource, signal?: AbortSignal): Promise<SourceConfig> => {
  if (source === "portal") {
    const response = await portalClient.get("/getAppInitialConfig", { signal });
    const config = portalExtensionConfigResponseSchema.parse(response.data);
    return {
      source,
      entries: normalizeConfig(config.uiExtension),
    };
  }

  const configResponse = await aiClient.get("/config", { signal });
  const config = aiExtensionConfigResponseSchema.parse(configResponse.data);
  return {
    source,
    entries: normalizeConfig(config.UI_EXTENSION),
  };
};

const addRoutePrefixes = (extensions: Omit<UiExtensionInstallation, "routePrefix">[]): UiExtensionInstallation[] => {
  const namedCounts = new Map<string, number>();
  const unnamedCount = extensions.filter((extension) => !extension.name).length;

  extensions.forEach((extension) => {
    if (extension.name) namedCounts.set(extension.name, (namedCounts.get(extension.name) ?? 0) + 1);
  });

  return extensions.map((extension) => {
    const firstSource = Object.keys(extension.sources)[0] as UiExtensionSource;
    const routePrefix = extension.name
      ? [namedCounts.get(extension.name) === 1 ? extension.name : `${firstSource}-${extension.name}`]
      : unnamedCount <= 1
        ? []
        : [firstSource];
    return { ...extension, routePrefix };
  });
};

const getQueryString = (context: UiExtensionRequestContext) => {
  const query = new URLSearchParams();
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, value);
  });
  return query.toString();
};

const callExtension = async <T>(
  extension: UiExtensionInstallation,
  path: string,
  context: UiExtensionRequestContext | undefined,
  body: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
) => {
  const query = context ? getQueryString(context) : "";
  const response = await fetch(
    `${joinExtensionUrl(getExtensionRequestUrl(extension.url), "api", path)}${query ? `?${query}` : ""}`,
    {
      method: body === undefined ? "GET" : "POST",
      mode: "cors",
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
  if (!response.ok) throw new Error(`UI extension request failed with status ${response.status}`);
  return schema.parse(await response.json());
};

export const realUiExtensionClient: UiExtensionApi = {
  async getExtensions(sources, signal) {
    const sourceResults = await Promise.allSettled(sources.map((source) => getSourceConfig(source, signal)));
    const merged = new Map<string, Omit<UiExtensionInstallation, "routePrefix" | "manifest">>();

    sourceResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(`Failed to load ${sources[index]} UI extension config`, result.reason);
        return;
      }
      result.value.entries.forEach((entry) => {
        const url = entry.url.replace(/\/+$/, "");
        const id = `${entry.name ?? ""}\n${url}`;
        const current = merged.get(id) ?? { id, name: entry.name, url, sources: {} };
        current.sources[result.value.source] = true;
        merged.set(id, current);
      });
    });

    const extensions = await Promise.all(
      [...merged.values()].map(async (extension) => {
        try {
          const response = await fetch(joinExtensionUrl(getExtensionRequestUrl(extension.url), "api", "manifests"), {
            method: "GET",
            mode: "cors",
            signal,
          });
          if (!response.ok) throw new Error(`status ${response.status}`);
          return { ...extension, manifest: uiExtensionManifestSchema.parse(await response.json()) };
        } catch (error) {
          console.warn(`Failed to load UI extension manifest from ${extension.url}`, error);
          return undefined;
        }
      }),
    );

    return addRoutePrefixes(extensions.filter((extension) => extension !== undefined));
  },
  async getNavbarLinks(extension, source, context, signal) {
    const response = await callExtension(
      extension,
      `${source}/navbarLinks`,
      context,
      {},
      navbarLinksResponseSchema,
      signal,
    );
    return (response.navbarLinks ?? []).map((link) => ({
      ...link,
      openInNewPage: link.openInNewPage ?? true,
      priority: link.priority ?? 0,
    }));
  },
  async rewriteNavigations(extension, source, context, navigations, signal) {
    const response = await callExtension(
      extension,
      `${source}/rewriteNavigations`,
      context,
      { navs: navigations },
      rewriteNavigationsResponseSchema,
      signal,
    );
    return response.navs;
  },
};
