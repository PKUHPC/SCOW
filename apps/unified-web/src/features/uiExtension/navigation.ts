import type {
  UiExtensionInstallation,
  UiExtensionNavigationItem,
  UiExtensionSource,
} from "src/features/uiExtension/types";

import { getExtensionRoutePath, isHttpUrl } from "src/features/uiExtension/paths";

const visitItems = (items: UiExtensionNavigationItem[], visitor: (item: UiExtensionNavigationItem) => void) => {
  items.forEach((item) => {
    visitor(item);
    if (item.children) visitItems(item.children, visitor);
  });
};

const convertReturnedItems = (
  currentItems: UiExtensionNavigationItem[],
  returnedItems: UiExtensionNavigationItem[],
  extension: UiExtensionInstallation,
) => {
  const currentByPath = new Map<string, UiExtensionNavigationItem>();
  visitItems(currentItems, (item) => {
    currentByPath.set(item.path, item);
    if (item.clickToPath) currentByPath.set(item.clickToPath, item);
  });

  const convertPath = (path: string) => {
    if (currentByPath.has(path) || path.startsWith("/extensions/") || isHttpUrl(path)) return path;
    return getExtensionRoutePath(extension, path);
  };

  return returnedItems.map((item): UiExtensionNavigationItem => {
    const original = currentByPath.get(item.path);
    return {
      ...item,
      path: convertPath(item.path),
      clickToPath: item.clickToPath ? convertPath(item.clickToPath) : undefined,
      icon: item.icon ?? original?.icon,
      svgIcon: item.svgIcon ?? original?.svgIcon,
      children: item.children ? convertReturnedItems(currentItems, item.children, extension) : undefined,
    };
  });
};

export const toUnifiedNavigationItems = (
  source: UiExtensionSource,
  originalItems: UiExtensionNavigationItem[],
  items: UiExtensionNavigationItem[] = originalItems,
) => {
  const originalPaths = new Set<string>();
  visitItems(originalItems, (item) => {
    originalPaths.add(item.path);
    if (item.clickToPath) originalPaths.add(item.clickToPath);
  });

  const convertPath = (path: string) => (originalPaths.has(path) ? `/${source}${path}` : path);
  return items.map((item): UiExtensionNavigationItem => ({
    ...item,
    path: convertPath(item.path),
    clickToPath: item.clickToPath ? convertPath(item.clickToPath) : undefined,
    children: item.children ? toUnifiedNavigationItems(source, originalItems, item.children) : undefined,
  }));
};

export const applyNavigationRewrite = convertReturnedItems;
