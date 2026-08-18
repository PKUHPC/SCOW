import type { UiExtensionApi, UiExtensionInstallation } from "src/features/uiExtension/types";

import { getScowPath } from "src/config/runtime";

const wait = () => new Promise((resolve) => setTimeout(resolve, 120));

const createMockExtension = (): UiExtensionInstallation => ({
  id: "mock-extension",
  name: "demo",
  url: `${window.location.origin}${getScowPath("/mock-ui-extension")}`,
  routePrefix: ["demo"],
  manifest: {
    portal: { navbarLinks: true, rewriteNavigations: true },
    ai: { navbarLinks: false, rewriteNavigations: false },
  },
  sources: {
    portal: true,
    ai: true,
  },
});

export const mockUiExtensionClient: UiExtensionApi = {
  async getExtensions(sources) {
    await wait();
    const extension = createMockExtension();
    extension.sources = Object.fromEntries(
      Object.entries(extension.sources).filter(([source]) => sources.includes(source as "portal" | "ai")),
    );
    return Object.keys(extension.sources).length > 0 ? [extension] : [];
  },
  async getNavbarLinks() {
    await wait();
    return [{ path: "/overview.html", text: "扩展概览", openInNewPage: false, priority: 10 }];
  },
  async rewriteNavigations(_extension, _source, _context, navigations) {
    await wait();
    return [
      ...navigations,
      {
        path: "/overview.html",
        text: "扩展功能",
      },
    ];
  },
};
