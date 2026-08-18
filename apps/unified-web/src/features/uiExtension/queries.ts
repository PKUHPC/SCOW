import type { ScowMetadata } from "src/api/metadata";
import type {
  SourcedNavbarLink,
  UiExtensionInstallation,
  UiExtensionNavigationItem,
  UiExtensionRequestContext,
  UiExtensionSource,
} from "src/features/uiExtension/types";

import { useQueries, useQuery } from "@tanstack/react-query";
import { getUiExtensionClient } from "src/features/uiExtension/client";
import { applyNavigationRewrite, toUnifiedNavigationItems } from "src/features/uiExtension/navigation";
import { getExtensionRoutePath, isHttpUrl } from "src/features/uiExtension/paths";

export const uiExtensionKeys = {
  all: ["uiExtension"] as const,
  extensions: (sources: UiExtensionSource[]) => [...uiExtensionKeys.all, "extensions", sources] as const,
  navbarLinks: () => [...uiExtensionKeys.all, "navbarLinks"] as const,
  navigations: () => [...uiExtensionKeys.all, "navigations"] as const,
};

const getSources = (metadata: ScowMetadata | undefined): UiExtensionSource[] =>
  metadata ? (["portal", "ai"] as const).filter((source) => Boolean(metadata.components[source])) : [];

const getContext = (
  userToken: string | undefined,
  dark: boolean,
  languageId: string,
): UiExtensionRequestContext => ({
  scowDark: dark ? "true" : "false",
  scowLangId: languageId,
  scowUserToken: userToken,
});

const isNavbarEnabled = (extension: UiExtensionInstallation, source: UiExtensionSource) => {
  const config = extension.manifest[source]?.navbarLinks;
  return config === true || (typeof config === "object" && config.enabled);
};

export const useUiExtensionsQuery = (metadata: ScowMetadata | undefined) => {
  const sources = getSources(metadata);
  return useQuery({
    queryKey: uiExtensionKeys.extensions(sources),
    queryFn: async ({ signal }) => (await getUiExtensionClient()).getExtensions(sources, signal),
    enabled: metadata !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
};

export const useUiExtensionNavbarLinks = (
  extensions: UiExtensionInstallation[],
  userToken: string | undefined,
  dark: boolean,
  languageId: string,
) => {
  const requests = extensions.flatMap((extension) =>
    (Object.keys(extension.sources) as UiExtensionSource[])
      .filter((source) => isNavbarEnabled(extension, source))
      .map((source) => ({ extension, source })),
  );
  const queries = useQueries({
    queries: requests.map(({ extension, source }) => {
      const config = extension.manifest[source]?.navbarLinks;
      const refreshInterval =
        typeof config === "object" && config.autoRefresh?.enabled ? config.autoRefresh.intervalMs : false;
      return {
        queryKey: [...uiExtensionKeys.navbarLinks(), extension.id, source, dark, languageId],
        queryFn: async ({ signal }) =>
          (await getUiExtensionClient()).getNavbarLinks(
            extension,
            source,
            getContext(userToken, dark, languageId),
            signal,
          ),
        enabled: Boolean(userToken),
        refetchInterval: refreshInterval,
      };
    }),
  });

  const links = queries
    .flatMap((query, requestIndex) => {
      const request = requests[requestIndex];
      return (query.data ?? []).map(
        (link, linkIndex): SourcedNavbarLink => ({
          ...link,
          id: `${request.extension.id}:${request.source}:${linkIndex}`,
          extensionId: request.extension.id,
          source: request.source,
          path: isHttpUrl(link.path) ? link.path : getExtensionRoutePath(request.extension, link.path),
        }),
      );
    })
    .sort((left, right) => right.priority - left.priority);

  return {
    data: links,
    isLoading: queries.some((query) => query.isLoading),
  };
};

export const useUiExtensionNavigationQuery = (
  source: UiExtensionSource,
  originalItems: UiExtensionNavigationItem[],
  extensions: UiExtensionInstallation[],
  userToken: string | undefined,
  dark: boolean,
  languageId: string,
) => {
  const fallback = toUnifiedNavigationItems(source, originalItems);
  const query = useQuery({
    queryKey: [
      ...uiExtensionKeys.navigations(),
      source,
      originalItems,
      extensions.map((extension) => extension.id),
      dark,
      languageId,
    ],
    queryFn: async ({ signal }) => {
      let currentItems = originalItems;
      for (const extension of extensions) {
        if (!extension.sources[source] || !extension.manifest[source]?.rewriteNavigations) continue;
        try {
          const returnedItems = await (await getUiExtensionClient()).rewriteNavigations(
            extension,
            source,
            getContext(userToken, dark, languageId),
            currentItems,
            signal,
          );
          currentItems = applyNavigationRewrite(currentItems, returnedItems, extension);
        } catch (error) {
          console.warn(`Failed to rewrite ${source} navigations with UI extension ${extension.name ?? extension.url}`, error);
        }
      }
      return toUnifiedNavigationItems(source, originalItems, currentItems);
    },
    placeholderData: fallback,
    enabled: Boolean(userToken),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return { ...query, data: query.data ?? fallback };
};
