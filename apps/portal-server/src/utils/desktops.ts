import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getClusterConfigs, LoginDeskopConfigSchema } from "@scow/config/build/cluster";
import { getPortalConfig } from "@scow/config/build/portal";
import { executeAsUser, getUserHomedir, sftpExists, sftpReadFile, sftpWriteFile } from "@scow/lib-ssh";
import { Desktop } from "@scow/protos/build/portal/desktop";
import { RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { NodeSSH } from "node-ssh";
import { join } from "path";
import { getShadowDeskList } from "src/utils/shadowDesk";
import { sshConnect } from "src/utils/ssh";
import { getTurboVNCBinPath, parseListOutput } from "src/utils/turbovnc";
import { Logger } from "ts-log";

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

/**
 * Get desktops file path of user
 * @param ssh ssh object connected as root
 * @param cluster cluster id
 * @param userId  user id
 * @param logger  logger
 * @returns desktops file path
 */
export async function getUserDesktopsFilePath(
  ssh: NodeSSH,
  cluster: string,
  userId: string,
  logger: Logger,
): Promise<string> {
  const userHomeDir = await getUserHomedir(ssh, userId, logger);
  const desktopDir = getDesktopConfig(cluster).desktopsDir;
  const userDesktopDir = join(userHomeDir, desktopDir);
  // make sure desktopsDir exists
  await executeAsUser(ssh, userId, logger, true, "mkdir", ["-p", userDesktopDir]);
  return join(userDesktopDir, "desktops.json");
}

/**
 * Read desktops file of user
 * @param ssh ssh object connected as root
 * @param desktopFilePath
 * @returns desktops
 */
export async function readDesktopsFile(ssh: NodeSSH, desktopFilePath: string): Promise<DesktopInfo[]> {
  const sftp = await ssh.requestSFTP();
  if (await sftpExists(sftp, desktopFilePath)) {
    const content = await sftpReadFile(sftp)(desktopFilePath);
    return JSON.parse(content.toString()) as DesktopInfo[];
  }
  return [];
}

/**
 * Wire desktops file of user
 * @param ssh ssh object connected as root
 * @param desktopFilePath
 * @param desktops desktops
 */
export async function writeDesktopsFile(ssh: NodeSSH, desktopFilePath: string, desktops: DesktopInfo[]): Promise<void> {
  const sftp = await ssh.requestSFTP();
  await sftpWriteFile(sftp)(desktopFilePath, JSON.stringify(desktops));
}

/**
 *
 * @param host loginode
 * @param userId user id
 * @param cluster cluster id
 * @param logger logger
 * @returns userDesktops
 */
export async function listUserDesktopsFromHost(host: string, cluster: string, userId: string, logger: Logger) {
  const vncserverBinPath = getTurboVNCBinPath(cluster, "vncserver");

  return await sshConnect(host, "root", logger, async (ssh) => {
    // list all running session
    const resp = await executeAsUser(ssh, userId, logger, true, vncserverBinPath, ["-list"]);

    const ids = parseListOutput(resp.stdout);

    const desktopFilePath = await getUserDesktopsFilePath(ssh, cluster, userId, logger);

    const desktops = await readDesktopsFile(ssh, desktopFilePath);

    let shadowdeskRunningDesktops: Desktop[] = [];
    if (getDesktopConfig(cluster).shadowDesk?.enabled) {
      let shadowdeskDesktops;
      const response = await getShadowDeskList(cluster);

      if (response.ok) {
        const resp = await response.json();
        shadowdeskDesktops = resp?.data?.desktops;
      } else {
        return response.json().then((errorData) => {
          throw new Error(`HTTP error! status: ${response.status}, data: ${JSON.stringify(errorData)}`);
        });
      }

      shadowdeskRunningDesktops = (
        shadowdeskDesktops?.filter((desktop) => desktop.username === userId && desktop.node === host) ?? []
      ).map((desktop) => {
        let desktopType = "";
        try {
          const desktopSettings = JSON.parse(desktop.desktop_settings);
          desktopType = desktopSettings.desktop_type;
        } catch (error) {
          logger.error("Error parsing JSON:", error);
        }
        return {
          displayId: desktop.id,
          desktopName: desktop?.desktop_name || "",
          wm: desktopType || "",
          createTime: desktop?.created_at,
          remoteControlTool: RemoteControlTool.SHADOWDESK,
        };
      });
    }

    const runningDesktops: Desktop[] = ids.map((id) => {
      const desktop = desktops.filter((x) => x.host === host).find((x) => x.displayId === id);
      return {
        displayId: id,
        desktopName: desktop ? desktop.desktopName : "",
        wm: desktop ? desktop.wm : "",
        createTime: desktop ? desktop.createTime : undefined,
        remoteControlTool: RemoteControlTool.VNC,
      };
    });
    return {
      host,
      desktops: [...runningDesktops, ...shadowdeskRunningDesktops],
    };
  });
}

/**
 * @param ssh ssh object connected as root
 * @param cluster cluster id
 * @param userId user id
 * @param deskTopInfo desktop info to add
 * @param logger logger
 */
export async function addDesktopToFile(
  ssh: NodeSSH,
  cluster: string,
  userId: string,
  deskTopInfo: DesktopInfo,
  logger: Logger,
): Promise<void> {
  const desktopFilePath = await getUserDesktopsFilePath(ssh, cluster, userId, logger);

  const desktops = await readDesktopsFile(ssh, desktopFilePath);
  desktops.push(deskTopInfo);

  await writeDesktopsFile(ssh, desktopFilePath, desktops);
  logger.info(`Desktop ${deskTopInfo.desktopName} added`);
}

/**
 * @param ssh ssh object connected as root
 * @param userId user id
 * @param displayId display id of desktop to remove
 * @param logger logger
 */
export async function removeDesktopFromFile(
  ssh: NodeSSH,
  cluster: string,
  userId: string,
  host: string,
  displayId: number,
  logger: Logger,
): Promise<void> {
  const desktopFilePath = await getUserDesktopsFilePath(ssh, cluster, userId, logger);

  const desktops = await readDesktopsFile(ssh, desktopFilePath);

  const index = desktops.findIndex((desktop) => desktop.host === host && desktop.displayId === displayId);

  if (index !== -1) {
    const removedDesktop = desktops[index];
    desktops.splice(index, 1);
    await writeDesktopsFile(ssh, desktopFilePath, desktops);
    logger.info(`Desktop ${removedDesktop.desktopName} removed`);
  }
}
