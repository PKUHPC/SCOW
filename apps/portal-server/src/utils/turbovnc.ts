import { getClusterConfigs } from "@scow/config/build/cluster";
import { getPortalConfig } from "@scow/config/build/portal";
import { executeAsUser, loggedExec } from "@scow/lib-ssh";
import { NodeSSH } from "node-ssh";
import { join } from "path";
import { parseIp } from "src/utils/proxy";
import { Logger } from "ts-log";

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

  // logger.error("Error parsing display id from %s", stdout);
  throw new Error("Error parsing display id");
}

export function displayIdToPort(displayId: number): number {
  return DISPLAY_ID_PORT_DELTA + displayId;
}

export function portToDisplayId(port: number): number {
  return port - DISPLAY_ID_PORT_DELTA;
}

/**
 * Refresh VNC session's OTP
 * @param ssh SSH connection
 * @param cluster cluster ID
 * @param runAsUserId the user id to run as. If null, run as SSH connection user
 * @param logger logger
 * @param displayId displayId
 * @returns new OTP
 */
export const refreshPassword = async (
  ssh: NodeSSH,
  cluster: string,
  runAsUserId: string | null,
  logger: Logger,
  displayId: number,
) => {
  const params = ["-o", "-display", ":" + displayId];

  const vncPasswdPath = getTurboVNCBinPath(cluster, "vncpasswd");

  const resp = runAsUserId
    ? await executeAsUser(ssh, runAsUserId, logger, true, vncPasswdPath, params)
    : await loggedExec(ssh, logger, true, vncPasswdPath, params);

  return parseOtp(resp.stderr);
};

/**
 * Refresh VNC session's OTP and get ip of compute node by proxy gateway
 * @param proxyGatewaySsh SSH connection to proxy gateway
 * @param cluster cluster ID
 * @param computeNode compute node
 * @param user the user id to run as.
 * @param logger logger
 * @param displayId displayId
 * @returns new OTP and compute node IP
 */
export const refreshPasswordByProxyGateway = async (
  proxyGatewaySsh: NodeSSH,
  cluster: string,
  computeNode: string,
  user: string,
  logger: Logger,
  displayId: number,
) => {
  const vncPasswdPath = getTurboVNCBinPath(cluster, "vncpasswd");
  const params = [computeNode, "sudo", "-u", user, "-s", vncPasswdPath, "-o", "-display", ":" + displayId];
  const [passwordResp, ipResp] = await Promise.all([
    loggedExec(proxyGatewaySsh, logger, true, "ssh", [...params]),
    loggedExec(proxyGatewaySsh, logger, true, "ping", ["-c 1", "-W 1", computeNode]),
  ]);
  const ip = parseIp(ipResp.stdout);
  const password = parseOtp(passwordResp.stderr);
  return { ip, password };
};
