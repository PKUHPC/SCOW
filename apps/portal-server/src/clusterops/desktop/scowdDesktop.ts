import { ConnectError } from "@connectrpc/connect";
import { ServiceError, status } from "@grpc/grpc-js";
import { getScowdClient } from "@scow/lib-scowd/build/client";
import { Desktop } from "@scow/protos/build/portal/desktop";
import { DesktopOps } from "src/clusterops/api/desktop";
import { getDesktopConfig } from "src/utils/desktops";
import { scowdClientNotFound } from "src/utils/errors";
import { certificates, getLoginNodeScowdUrl, mapConnectRpcStatusToGrpc } from "src/utils/scowd";
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

    const client = getScowdClient(scowdUrl, certificates);
    if (!client) { throw scowdClientNotFound(scowdUrl); }

    try {
      const res = await client.desktop.createDesktop({
        userId,
        vncServerBinPath: vncserverBinPath,
        maxDesktops, wm, desktopName,
        desktopDir: desktopsDir, loginNode: host,
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

    const { loginNode: host, displayId, userId } = request;

    const vncserverBinPath = getTurboVNCBinPath(cluster, "vncserver");

    const scowdUrl = getLoginNodeScowdUrl(cluster, host);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${host}` } as ServiceError;
    }

    const client = getScowdClient(scowdUrl, certificates);
    if (!client) { throw scowdClientNotFound(scowdUrl); }

    const { desktopsDir } = getDesktopConfig(cluster);

    try {
      await client.desktop.killDesktop({
        userId, vncServerBinPath: vncserverBinPath,
        displayId, desktopDir: desktopsDir, loginNode: host,
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

    const { loginNode: host, displayId, userId } = request;

    const scowdUrl = getLoginNodeScowdUrl(cluster, host);

    if (!scowdUrl) {
      throw { code: status.INTERNAL, details: `Cluster ${cluster} not have login node ${host}` } as ServiceError;
    }

    const client = getScowdClient(scowdUrl, certificates);
    if (!client) { throw scowdClientNotFound(scowdUrl); }

    const vncPasswdPath = getTurboVNCBinPath(cluster, "vncpasswd");

    try {
      const res = await client.desktop.connectToDesktop({ userId, vncPasswdPath: vncPasswdPath, displayId });

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

    const client = getScowdClient(scowdUrl, certificates);
    if (!client) { throw scowdClientNotFound(scowdUrl); }

    try {
      const res = await client.desktop.listUserDesktops({
        userId,
        vncServerBinPath: vncserverBinPath,
        loginNode: host,
        desktopDir: desktopsDir,
      });

      const userDeskTops: Desktop[] = res.userDesktops.map((desktop) => {

        const createTime = !desktop.createTime ? undefined
          : new Date(Number((desktop.createTime.seconds * BigInt(1000))
            + BigInt(desktop.createTime.nanos / 1000000)));

        return {
          desktopName: desktop.desktopName,
          displayId: desktop.displayId,
          wm: desktop.wm,
          createTime: createTime?.toISOString(),
        };
      });

      return {
        host,
        desktops: userDeskTops.map((desktop) => {
          return {
            displayId: desktop.displayId,
            desktopName: desktop.desktopName,
            wm: desktop.wm,
            createTime: desktop.createTime,
          };
        }),
      };
    } catch (err) {
      if (err instanceof ConnectError) {
        throw { code: mapConnectRpcStatusToGrpc(err.code), details: err.message } as ServiceError;
      }
      throw err;
    }
  },
});
