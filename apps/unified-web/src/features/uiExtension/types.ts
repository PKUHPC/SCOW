export type UiExtensionSource = "portal" | "ai";

export interface UiExtensionConfigEntry {
  name?: string;
  url: string;
}

export interface UiExtensionNavbarConfig {
  enabled: boolean;
  autoRefresh?: {
    enabled: boolean;
    intervalMs: number;
  };
}

export interface UiExtensionSourceManifest {
  rewriteNavigations: boolean;
  navbarLinks: boolean | UiExtensionNavbarConfig;
}

export interface UiExtensionManifest {
  portal?: UiExtensionSourceManifest;
  mis?: UiExtensionSourceManifest;
  ai?: UiExtensionSourceManifest;
}

export interface UiExtensionInstallation {
  id: string;
  name?: string;
  url: string;
  routePrefix: string[];
  manifest: UiExtensionManifest;
  sources: Partial<Record<UiExtensionSource, true>>;
}

export interface UiExtensionRequestContext {
  scowUserToken?: string;
  scowDark: "true" | "false";
  scowLangId: string;
}

export interface UiExtensionIcon {
  src: string;
  alt?: string;
}

export interface UiExtensionNavbarLink {
  path: string;
  text: string;
  icon?: UiExtensionIcon;
  openInNewPage: boolean;
  priority: number;
  autoRefresh?: {
    intervalMs: number;
  };
}

export interface UiExtensionNavigationItem {
  path: string;
  clickToPath?: string;
  text: string;
  icon?: UiExtensionIcon;
  svgIcon?: string;
  openInNewPage?: boolean;
  hideIfNotActive?: boolean;
  children?: UiExtensionNavigationItem[];
}

export interface SourcedNavbarLink extends UiExtensionNavbarLink {
  id: string;
  extensionId: string;
  source: UiExtensionSource;
}

export interface UiExtensionApi {
  getExtensions(sources: UiExtensionSource[], signal?: AbortSignal): Promise<UiExtensionInstallation[]>;
  getNavbarLinks(
    extension: UiExtensionInstallation,
    source: UiExtensionSource,
    context: UiExtensionRequestContext,
    signal?: AbortSignal,
  ): Promise<UiExtensionNavbarLink[]>;
  rewriteNavigations(
    extension: UiExtensionInstallation,
    source: UiExtensionSource,
    context: UiExtensionRequestContext,
    navigations: UiExtensionNavigationItem[],
    signal?: AbortSignal,
  ): Promise<UiExtensionNavigationItem[]>;
}
