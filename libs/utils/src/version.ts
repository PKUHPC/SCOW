import { existsSync, readFileSync } from "fs";
// import { join } from "path";

interface VersionJsonInfo {
  tag?: string;
  commit: string;
}

export type VersionInfo = VersionJsonInfo;

export function readVersionFile(versionJsonFileName = "version.json") {
  const jsonInfo: VersionInfo = existsSync(versionJsonFileName)
    ? JSON.parse(readFileSync(versionJsonFileName, "utf-8"))
    : {};

  return jsonInfo;
}
