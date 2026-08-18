import type { ScowMetadata } from "src/api/metadata";

import { getLoginPath } from "src/api/sessionPaths";

const metadata = (components: ScowMetadata["components"]): ScowMetadata => ({
  basePath: "/",
  version: "test",
  components,
});

describe("getLoginPath", () => {
  test("uses the root Portal login path", () => {
    expect(getLoginPath(metadata({ portal: "/", mis: "/mis" }))).toBe("/api/auth");
  });

  test("does not duplicate a custom system base path", () => {
    expect(getLoginPath(metadata({ portal: "/scow", mis: "/scow/mis" }))).toBe("/scow/api/auth");
  });

  test("falls back to the AI login path when Portal is disabled", () => {
    expect(getLoginPath(metadata({ ai: "/scow/ai", mis: "/scow/mis" }))).toBe("/scow/ai/api/auth");
  });
});
