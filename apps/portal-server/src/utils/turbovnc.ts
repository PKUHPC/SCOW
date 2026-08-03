import { getClusterConfigs } from "@scow/config/build/cluster";
import { getPortalConfig } from "@scow/config/build/portal";
import { join } from "path";

export function getTurboVNCPath(cluster: string) {
  const commonTurboVNCPath = getPortalConfig().turboVNCPath;

  const clusterTurboVNCPath = getClusterConfigs(undefined, undefined, ["hpc"])[cluster].turboVNCPath;

  return clusterTurboVNCPath || commonTurboVNCPath;
}

export function getTurboVNCBinPath(cluster: string, cmd: string) {
  const turboVNCPath = getTurboVNCPath(cluster);

  return join(turboVNCPath, "bin", cmd);
}

const DISPLAY_ID_PORT_DELTA = 5900;

export function parseListOutput(output: string): number[] {
  const ids = [] as number[];
  for (const line of output.split("\n")) {
    if (line.startsWith(":")) {
      const parts = line.split(" ");
      ids.push(parseInt(parts[0].substring(1)));
    }
  }

  return ids;
}

export function parseOtp(stderr: string): string {
  const indicator = "Full control one-time password: ";
  for (const line of stderr.split("\n")) {
    if (line.startsWith(indicator)) {
      return line.substring(indicator.length).trim();
    }
  }

  throw new Error("Error parsing OTP");
}

export function parseDisplayId(stdout: string): number {
  // Desktop 'TurboVNC: t001:2 (2001213077)' started on display t001:2
  // Desktop 'TurboVNC: cn1:21 (demo_admin)' started on display cn1:21
  const regex = /^Desktop '.*' started on display .*:(\d+)$/;

  const lines = stdout.split("\n");

  for (const line of lines) {
    const matches = regex.exec(line);
    if (!matches) {
      continue;
    }

    return +matches[1];
  }

  throw new Error("Error parsing display id");
}

export function displayIdToPort(displayId: number): number {
  return DISPLAY_ID_PORT_DELTA + displayId;
}

export function portToDisplayId(port: number): number {
  return port - DISPLAY_ID_PORT_DELTA;
}
