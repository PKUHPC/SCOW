import {
  navbarLinksResponseSchema,
  rewriteNavigationsResponseSchema,
  uiExtensionConfigSchema,
} from "src/features/uiExtension/schemas";

describe("UI extension URL validation", () => {
  test.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "//evil.example.com"])(
    "rejects unsafe navbar target %s",
    (path) => {
      expect(
        navbarLinksResponseSchema.safeParse({
          navbarLinks: [{ path, text: "Unsafe" }],
        }).success,
      ).toBe(false);
    },
  );

  test("rejects unsafe navigation click target", () => {
    expect(
      rewriteNavigationsResponseSchema.safeParse({
        navs: [{ path: "/safe", clickToPath: "javascript:alert(1)", text: "Unsafe" }],
      }).success,
    ).toBe(false);
  });

  test("rejects a non-HTTP extension service URL", () => {
    expect(uiExtensionConfigSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
  });

  test("accepts relative targets and HTTP(S) URLs", () => {
    expect(
      navbarLinksResponseSchema.safeParse({
        navbarLinks: [
          { path: "/reports", text: "Reports" },
          { path: "https://example.com/help", text: "Help" },
        ],
      }).success,
    ).toBe(true);
  });
});
