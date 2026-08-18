import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "fs";
import path from "path";

const textFileExtensions = new Set([".css", ".html", ".js", ".json"]);

export function joinUrlPath(...segments: string[]) {
  const result = path.posix.join("/", ...segments.filter(Boolean));
  return result === "/" ? "" : result.replace(/\/$/, "");
}

function replaceRuntimePlaceholders(directory: string, replacements: Record<string, string>) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    if (statSync(filePath).isDirectory()) {
      replaceRuntimePlaceholders(filePath, replacements);
      continue;
    }

    if (!textFileExtensions.has(path.extname(filePath))) {
      continue;
    }

    const source = readFileSync(filePath, "utf8");
    const result = Object.entries(replacements).reduce(
      (content, [placeholder, value]) => content.replaceAll(placeholder, value),
      source,
    );
    writeFileSync(filePath, result);
  }
}

export function prepareUnifiedWebAssets(options: {
  basePath: string;
  unifiedWebPath: string;
  sourceDir: string;
  runtimeRoot: string;
}) {
  const scowBasePath = joinUrlPath(options.basePath);
  const unifiedBasePath = joinUrlPath(options.basePath, options.unifiedWebPath);
  const destination = path.join(options.runtimeRoot, unifiedBasePath.replace(/^\//, ""));

  rmSync(options.runtimeRoot, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(options.sourceDir, destination, { recursive: true });

  replaceRuntimePlaceholders(destination, {
    "/@UNIFIED_BASE_PATH@": unifiedBasePath,
    "/@SCOW_BASE_PATH@": scowBasePath,
  });
}
