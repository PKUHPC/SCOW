import { ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { Desktop } from "@scow/protos/build/portal/desktop";
import { RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { DesktopOps } from "src/clusterops/api/desktop";
import { getDesktopConfig } from "src/utils/desktops";
import { scowdClientNotFound } from "src/utils/errors";
import { getLoginNodeScowdUrl, getScowdClientByUrl, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
import { getShadowDeskList } from "src/utils/shadowDesk";
import { displayIdToPort, getTurboVNCBinPath } from "src/utils/turbovnc";

export const scowdDesktopServices = (cluster: string): DesktopOps => ({
  createDesktop: async (request) => {
    const { loginNode: host, wm, userId, desktopName } = request;

    const vncserverBinPath = getTurboVNCBinPath(cluster, "vncserver");
    const { maxDesktops, desktopsDir } = getDesktopConfig(cluster);

    const scowdUrl = getLoginNodeScowdUrl(cluster, host);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${host}` } as ServiceError;
    }

    const client = getScowdClientByUrl(scowdUrl);
    if (!client) {
      throw scowdClientNotFound(scowdUrl);
    }

    try {
      const res = await client.desktop.createDesktop({
        userId,
        vncServerBinPath: vncserverBinPath,
        maxDesktops,
        wm,
        desktopName,
        desktopDir: desktopsDir,
        loginNode: host,
      });

      return { host, password: res.password, port: displayIdToPort(res.displayId) };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  killDesktop: async (request) => {
    const { loginNode: host, displayId, userId, id } = request;

    const vncserverBinPath = getTurboVNCBinPath(cluster, "vncserver");

    const scowdUrl = getLoginNodeScowdUrl(cluster, host);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${host}` } as ServiceError;
    }

    const client = getScowdClientByUrl(scowdUrl);
    if (!client) {
      throw scowdClientNotFound(scowdUrl);
    }

    const { desktopsDir } = getDesktopConfig(cluster);

    try {
      await client.desktop.killDesktop({
        id,
        userId,
        vncServerBinPath: vncserverBinPath,
        displayId,
        desktopDir: desktopsDir,
        loginNode: host,
      });

      return {};
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  connectToDesktop: async (request) => {
    const { loginNode: host, displayId, userId, id } = request;

    const scowdUrl = getLoginNodeScowdUrl(cluster, host);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${host}` } as ServiceError;
    }

    const client = getScowdClientByUrl(scowdUrl);
    if (!client) {
      throw scowdClientNotFound(scowdUrl);
    }

    const vncPasswdPath = getTurboVNCBinPath(cluster, "vncpasswd");

    try {
      const res = await client.desktop.connectToDesktop({ userId, vncPasswdPath: vncPasswdPath, displayId, id });

      return { host, port: displayIdToPort(displayId), password: res.password };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },

  listUserDesktops: async (request) => {
    const { loginNode: host, userId } = request;

    const vncserverBinPath = getTurboVNCBinPath(cluster, "vncserver");
    const { desktopsDir } = getDesktopConfig(cluster);

    const scowdUrl = getLoginNodeScowdUrl(cluster, host);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${host}` } as ServiceError;
    }

    const client = getScowdClientByUrl(scowdUrl);
    if (!client) {
      throw scowdClientNotFound(scowdUrl);
    }

    try {
      const vncPromise = client.desktop.listUserDesktops({
        userId,
        vncServerBinPath: vncserverBinPath,
        loginNode: host,
        desktopDir: desktopsDir,
      });

      const shadowDeskEnabled = getDesktopConfig(cluster).shadowDesk?.enabled;
      const shadowDeskPromise = shadowDeskEnabled ? getShadowDeskList(cluster) : Promise.resolve(undefined);

      const [vncRes, shadowRes] = await Promise.all([vncPromise, shadowDeskPromise]);

      const userDeskTops: Desktop[] = vncRes.userDesktops.map((desktop) => {
        const createTime = !desktop.createTime
          ? undefined
          : new Date(
              Number(
                desktop.createTime.seconds * BigInt(1000) + BigInt(Math.floor(desktop.createTime.nanos / 1000000)),
              ),
            );

        return {
          id: desktop.id,
          desktopName: desktop.desktopName,
          displayId: desktop.displayId,
          wm: desktop.wm,
          createTime: createTime?.toISOString(),
          isActive: desktop.isActive,
          remoteControlTool: RemoteControlTool.VNC,
        };
      });

      let shadowdeskUserDeskTops: Desktop[] = [];
      if (shadowDeskEnabled && shadowRes) {
        let shadowdeskDesktops;
        if (shadowRes.ok) {
          const resp = await shadowRes.json();
          shadowdeskDesktops = resp?.data?.desktops;
        } else {
          const errorData = await shadowRes.json();
          throw new Error(`HTTP error! status: ${shadowRes.status}, data: ${JSON.stringify(errorData)}`);
        }

        shadowdeskUserDeskTops = (
          shadowdeskDesktops?.filter((desktop) => desktop.username === userId && desktop.node === host) ?? []
        ).map((desktop) => {
          let desktopType = "";
          try {
            const desktopSettings = JSON.parse(desktop.desktop_settings);
            desktopType = desktopSettings.desktop_type;
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
          return {
            id: desktop.id,
            displayId: desktop.id,
            desktopName: desktop?.desktop_name || "",
            wm: desktopType || "",
            isActive: true,
            createTime: desktop?.created_at,
            remoteControlTool: RemoteControlTool.SHADOWDESK,
          };
        });
      }

      return {
        host,
        desktops: [...userDeskTops, ...shadowdeskUserDeskTops],
      };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },
});
