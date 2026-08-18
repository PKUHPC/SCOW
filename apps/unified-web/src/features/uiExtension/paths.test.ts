import {
  getExtensionPageMatch,
  getExtensionRoutePath,
  isHttpUrl,
  isSafeExtensionPath,
} from "src/features/uiExtension/paths";
import type { UiExtensionInstallation } from "src/features/uiExtension/types";

const createExtension = (id: string, routePrefix: string[]): UiExtensionInstallation => ({
  id,
  name: routePrefix[0],
  routePrefix,
  url: `https://${id}.example.com`,
  manifest: {},
  sources: { portal: true },
});

describe("UI extension paths", () => {
  test("builds encoded routes without losing query parameters", () => {
    const extension = createExtension("named", ["my extension"]);
    expect(getExtensionRoutePath(extension, "/reports/daily?cluster=hpc#summary")).toBe(
      "/extensions/my%20extension/reports/daily?cluster=hpc#summary",
    );
  });

  test("uses the longest matching extension prefix", () => {
    const unnamed = createExtension("unnamed", []);
    const named = createExtension("named", ["named"]);
    expect(getExtensionPageMatch([unnamed, named], "named/reports"))?.toEqual({
      extension: named,
      extensionPath: ["reports"],
    });
  });

  test.each(["https://example.com/path", "http://example.com"])("allows HTTP(S) URL %s", (url) => {
    expect(isHttpUrl(url)).toBe(true);
    expect(isSafeExtensionPath(url)).toBe(true);
  });

  test.each([
    "javascript:alert(document.domain)",
    "  javascript:alert(document.domain)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//evil.example.com/path",
    "\\\\evil.example.com\\path",
  ])("rejects unsafe extension target %s", (target) => {
    expect(isHttpUrl(target)).toBe(false);
    expect(isSafeExtensionPath(target)).toBe(false);
  });

  test.each(["/reports", "reports/daily", "?tab=summary", "#details"])(
    "allows relative extension target %s",
    (target) => expect(isSafeExtensionPath(target)).toBe(true),
  );
});
