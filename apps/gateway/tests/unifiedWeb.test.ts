import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { joinUrlPath, prepareUnifiedWebAssets } from "src/unifiedWeb";

it("joins scow url paths without duplicate separators", () => {
  expect(joinUrlPath("", "/")).toBe("");
  expect(joinUrlPath("/scow", "/", "/api")).toBe("/scow/api");
  expect(joinUrlPath("/scow/", "/ai", "/api")).toBe("/scow/ai/api");
});

it("copies unified web assets and replaces runtime paths", () => {
  const testRoot = mkdtempSync(path.join(tmpdir(), "scow-unified-web-"));
  const sourceDir = path.join(testRoot, "source");
  const runtimeRoot = path.join(testRoot, "runtime");
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(
    path.join(sourceDir, "index.html"),
    '<script src="/@UNIFIED_BASE_PATH@/assets/index.js"></script>',
  );
  mkdirSync(path.join(sourceDir, "assets"));
  writeFileSync(path.join(sourceDir, "assets/index.js"), 'const basePath = "/@SCOW_BASE_PATH@";');

  prepareUnifiedWebAssets({
    basePath: "/scow",
    unifiedWebPath: "/unified",
    sourceDir,
    runtimeRoot,
  });

  const destination = path.join(runtimeRoot, "scow/unified");
  expect(readFileSync(path.join(destination, "index.html"), "utf8")).toContain(
    'src="/scow/unified/assets/index.js"',
  );
  expect(readFileSync(path.join(destination, "assets/index.js"), "utf8")).toContain(
    'basePath = "/scow"',
  );
});
