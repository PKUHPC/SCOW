#!/usr/bin/env node

import { execSync } from "child_process";
import * as esbuild from "esbuild";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

console.log("Building CLI with esbuild...");

// Run type checking first
console.log("Running type check...");
try {
  execSync("pnpm exec tsc --noEmit -p tsconfig.build.json", {
    cwd: rootDir,
    stdio: "inherit",
  });
  console.log("✓ Type check passed\n");
} catch {
  console.error("\n✗ Type check failed!");
  console.error("Please fix the type errors before building.");
  process.exit(1);
}

// Ensure build directory exists
const buildDir = join(rootDir, "build");
if (!existsSync(buildDir)) {
  mkdirSync(buildDir, { recursive: true });
}

try {
  // Bundle with esbuild
  await esbuild.build({
    entryPoints: [join(rootDir, "src/index.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    outfile: join(buildDir, "bundle.js"),
    format: "cjs",
    banner: {
      js: "#!/usr/bin/env node\n",
    },
    sourcemap: false,
    minify: false,
    treeShaking: true,
    // Resolve paths
    tsconfig: join(rootDir, "tsconfig.build.json"),
    loader: {
      ".node": "file",
    },
    logLevel: "info",
  });

  console.log("✓ esbuild bundle created successfully");

  // Package with pkg
  console.log("\nPackaging with pkg...");
  execSync("pnpm exec pkg --compress GZip .", {
    cwd: rootDir,
    stdio: "inherit",
  });

  console.log("\n✓ Build completed successfully!");
  console.log(`Executables are in: ${join(rootDir, "exe")}`);
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
