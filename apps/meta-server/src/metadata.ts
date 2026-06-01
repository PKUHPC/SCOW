import { InstallConfigSchema } from "@scow/config/build/install";
import { readVersionFile } from "@scow/utils/build/version";
import path from "path";

import packageJson from "../package.json";

export interface Metadata {
  basePath: string;
  version: string;
  components: {
    portal?: string;
    mis?: string;
    ai?: string;
    quantum?: string;
    notification?: string;
    resource?: string;
  };
}

function joinPath(...segments: string[]) {
  const result = path.posix.normalize(path.posix.join(...segments));

  if (result !== "/" && result.endsWith("/")) {
    return result.substring(0, result.length - 1);
  }

  return result;
}

export function getMetadata(config: InstallConfigSchema): Metadata {
  const basePath = config.basePath === "/" ? "" : config.basePath;
  const version = readVersionFile().tag ?? packageJson.version;

  return {
    basePath: config.basePath,
    version,
    components: {
      portal: config.portal?.enabled ? joinPath(basePath, config.portal.basePath) : undefined,
      mis: config.mis?.enabled ? joinPath(basePath, config.mis.basePath) : undefined,
      ai: config.ai?.enabled ? joinPath(basePath, config.ai.basePath) : undefined,
      quantum: config.quantum?.enabled ? joinPath(basePath, config.quantum.basePath) : undefined,
      notification: config.notification ? joinPath(basePath, config.notification.basePath) : undefined,
      resource: config.resource ? joinPath(basePath, config.resource.basePath) : undefined,
    },
  };
}
