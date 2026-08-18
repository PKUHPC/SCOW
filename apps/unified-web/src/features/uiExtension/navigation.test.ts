import { applyNavigationRewrite, toUnifiedNavigationItems } from "src/features/uiExtension/navigation";
import type { UiExtensionInstallation, UiExtensionNavigationItem } from "src/features/uiExtension/types";

const extension: UiExtensionInstallation = {
  id: "demo",
  name: "demo",
  url: "https://extension.example.com",
  routePrefix: ["demo"],
  manifest: {},
  sources: { portal: true },
};

describe("UI extension navigation rewrite", () => {
  test("preserves existing paths and maps inserted paths to the extension page", () => {
    const original: UiExtensionNavigationItem[] = [
      { path: "/jobs", text: "作业" },
      { path: "/apps", text: "应用" },
    ];
    const returned: UiExtensionNavigationItem[] = [
      { path: "/apps", text: "应用中心" },
      { path: "/reports", text: "扩展报表" },
      { path: "https://example.com/help", text: "帮助" },
    ];

    const rewritten = applyNavigationRewrite(original, returned, extension);
    expect(rewritten.map((item) => item.path)).toEqual([
      "/apps",
      "/extensions/demo/reports",
      "https://example.com/help",
    ]);
    expect(toUnifiedNavigationItems("portal", original, rewritten).map((item) => item.path)).toEqual([
      "/portal/apps",
      "/extensions/demo/reports",
      "https://example.com/help",
    ]);
  });

  test("maps nested original routes into the source namespace", () => {
    const original: UiExtensionNavigationItem[] = [
      {
        path: "/jobs",
        text: "作业",
        children: [{ path: "/jobs/running", text: "运行中" }],
      },
    ];
    expect(toUnifiedNavigationItems("ai", original)[0].children?.[0].path).toBe("/ai/jobs/running");
  });

  test("does not preserve executable URL schemes", () => {
    const rewritten = applyNavigationRewrite(
      [{ path: "/jobs", text: "作业" }],
      [{ path: "javascript:alert(document.domain)", text: "恶意链接" }],
      extension,
    );

    expect(rewritten[0].path).toBe("/extensions/demo/javascript%3Aalert(document.domain)");
  });
});
