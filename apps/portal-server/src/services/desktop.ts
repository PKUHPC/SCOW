import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getLoginNode } from "@scow/config/build/cluster";
import { DesktopServiceServer, DesktopServiceService, RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { getClusterOps } from "src/clusterops";
import { configClusters } from "src/config/clusters";
import { checkActivatedClusters, checkLoginNodeInCluster } from "src/utils/clusters";
import { ensureEnabled, getDesktopConfig } from "src/utils/desktops";
import { clusterNotFound } from "src/utils/errors";
import { connectToShadowDesk, creatShadowDesk, deleteShadowDesk } from "src/utils/shadowDesk";

export const desktopServiceServer = plugin((server) => {

  server.addService<DesktopServiceServer>(DesktopServiceService, {
    createDesktop: async ({ request, logger }) => {
      const { cluster, loginNode: host, wm, userId, desktopName, remoteControlTool } = request;

      const maxDesktops: number = getDesktopConfig(cluster)?.maxDesktops || 0;

      const clusterops = getClusterOps(cluster);
      const clusters = configClusters;
      const loginNodes = clusters[cluster]?.loginNodes?.map(getLoginNode);
      if (!loginNodes) {
        throw clusterNotFound(cluster);
      }

      const listResp = await Promise.all(loginNodes.map(async (loginNode) => {
        return await clusterops.desktop.listUserDesktops({ loginNode: loginNode.address, userId }, logger);
      })).then((response) => {
        return response;
      });
      const desktopCount = listResp?.[0]?.desktops?.length || 0;

      // find if the user has running session 确定现有的桌面是否超过了maxDesktops
      if (desktopCount < maxDesktops) {
        if (remoteControlTool === RemoteControlTool.SHADOWDESK) {
          const creatResp = await creatShadowDesk(cluster, host, userId, desktopName || "", wm);

          let shadowdeskUrl: string = "";

          if (creatResp.ok) {
            const resp = await creatResp.json();
            shadowdeskUrl = String(resp?.data?.url);
          } else {
            return creatResp.json().then((errorData) => {
              logger.error(`creat shadowdesk desktop error: ${errorData}`);
              throw { code: Status.INTERNAL, message: `${JSON.stringify(errorData)}` } as ServiceError;
            });
          }
          return [{ shadowdeskUrl, host: "", port: 0, password: "" }];
        } else {
          await checkActivatedClusters({ clusterIds: cluster });

          ensureEnabled(cluster);

          const availableWms = getDesktopConfig(cluster).wms;

          if (availableWms.find((x) => x.wm === wm) === undefined) {
            throw { code: Status.INVALID_ARGUMENT, message: `${wm} is not a acceptable wm.` } as ServiceError;
          }

          checkLoginNodeInCluster(cluster, host);

          const clusterops = getClusterOps(cluster);

          const reply = await clusterops.desktop.createDesktop(
            { loginNode: host, wm, userId, desktopName: desktopName ?? "" },
            logger);

          return [{ ...reply }];
        }
      } else {
        throw { code: Status.RESOURCE_EXHAUSTED, message: "Too many desktops" } as ServiceError;
      }
    },

    killDesktop: async ({ request, logger }) => {

      const { cluster, loginNode: host, displayId, userId, desktopInfo } = request;
      if (desktopInfo?.desktop?.$case === "shadowdesk") {
        const desktopName = desktopInfo.desktop.shadowdesk.desktopName;
        const response = await deleteShadowDesk(cluster, desktopName || "");
        if (!response.ok) {
          return response.json().then((errorData) => {
            logger.error(`delete shadowdesk desktop error: ${errorData}`);
            throw { code: Status.INTERNAL } as ServiceError;
          });
        }
        return [{}];
      }

      await checkActivatedClusters({ clusterIds: cluster });

      ensureEnabled(cluster);

      checkLoginNodeInCluster(cluster, host);

      const clusterops = getClusterOps(cluster);

      await clusterops.desktop.killDesktop({ loginNode: host, userId,
        displayId: desktopInfo?.desktop?.vnc.displayId || displayId }, logger);

      return [{}];
    },

    connectToDesktop: async ({ request, logger }) => {
      const { cluster, loginNode: host, displayId, userId, desktopInfo } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      ensureEnabled(cluster);

      checkLoginNodeInCluster(cluster, host);
      if (desktopInfo?.desktop?.$case === "shadowdesk") {
        const desktopName = desktopInfo.desktop.shadowdesk.desktopName;
        const clusterops = getClusterOps(cluster);
        const desktopsListRes = await clusterops.desktop.listUserDesktops({ loginNode: host, userId }, logger);
        let shadowdeskUrl;

        // 连接前判断桌面是否属于当前用户
        if (desktopsListRes.desktops.some((desktop) => desktop.desktopName === desktopName)) {
          const response = await connectToShadowDesk(cluster, desktopName || "");
          if (response.ok) {
            const resp = await response.json();
            shadowdeskUrl = resp?.data?.url;
          } else {
            return response.json().then((errorData) => {
              logger.error(`connect shadowdesk desktop error: ${errorData}`);
              throw { code: Status.INTERNAL, message: `${JSON.stringify(errorData)}` } as ServiceError;
            });
          }
        } else {
          throw { code: Status.NOT_FOUND, message: `ShadowDesk desktop ${desktopName} not found.` } as ServiceError;
        }
        return [{ shadowdeskUrl, host: "", port: 0, password: "" }];
      } else {
        const clusterops = getClusterOps(cluster);

        const reply = await clusterops.desktop.connectToDesktop({ loginNode: host, userId, displayId }, logger);

        return [{ ...reply }];
      };
    },

    listUserDesktops: async ({ request, logger }) => {

      const { cluster, loginNode: host, userId } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      ensureEnabled(cluster);

      const clusterops = getClusterOps(cluster);

      if (host) {
        checkLoginNodeInCluster(cluster, host);
        const reply = await clusterops.desktop.listUserDesktops({ loginNode: host, userId }, logger);
        return [{ userDesktops: [{ ...reply }]}];
      }

      const clusters = configClusters;
      const loginNodes = clusters[cluster]?.loginNodes?.map(getLoginNode);
      if (!loginNodes) {
        throw clusterNotFound(cluster);
      }
      // 请求集群的所有登录节点
      return await Promise.all(loginNodes.map(async (loginNode) => {
        return await clusterops.desktop.listUserDesktops({ loginNode: loginNode.address, userId }, logger);
      })).then((response) => {
        return [{ userDesktops: response }];
      });
    },

    listAvailableWms: async ({ request }) => {

      const { cluster } = request;
      await checkActivatedClusters({ clusterIds: cluster });

      ensureEnabled(cluster);

      const result = getDesktopConfig(cluster).wms;


      return [{ wms: result }];
    },
  });

});
