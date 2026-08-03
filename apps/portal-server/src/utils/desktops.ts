import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getClusterConfigs, LoginDeskopConfigSchema } from "@scow/config/build/cluster";
import { getPortalConfig } from "@scow/config/build/portal";
import { Desktop } from "@scow/protos/build/portal/desktop";

const desktopConfigCache = new Map<string, LoginDeskopConfigSchema>();

export function getDesktopConfig(cluster: string): LoginDeskopConfigSchema {
  const cached = desktopConfigCache.get(cluster);
  if (cached) {
    return cached;
  }

  const desktopConfig = {
    ...getPortalConfig().loginDesktop,
    ...getClusterConfigs(undefined, undefined, ["hpc"])[cluster].loginDesktop,
  };

  desktopConfigCache.set(cluster, desktopConfig);

  return desktopConfig;
}

export function ensureEnabled(cluster: string) {
  const enabled = getDesktopConfig(cluster).enabled;

  if (!enabled) {
    throw { code: Status.UNAVAILABLE, message: "Login desktop is not enabled" } as ServiceError;
  }
}

export type DesktopInfo = Desktop & { host: string };
