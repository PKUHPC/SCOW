import { plugin } from "@ddadaal/tsgrpc-server";
import { ServiceError } from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { getLoginNode } from "@scow/config/build/cluster";
import { DesktopServiceServer, DesktopServiceService, RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { getClusterOps } from "src/clusterops";
import { configClusters } from "src/config/clusters";
import { checkActivatedClusters, checkLoginNodeInCluster, checkUserClusterPermission } from "src/utils/clusters";
import { ensureEnabled, getDesktopConfig } from "src/utils/desktops";
import { clusterNotFound } from "src/utils/errors";
import { connectToShadowDesk, createShadowDesk, deleteShadowDesk } from "src/utils/shadowDesk";

const getWmIconPath = (wm: object) => {
  return "iconPath" in wm && typeof wm.iconPath === "string" ? wm.iconPath : undefined;
};

export const desktopServiceServer = plugin((server) => {
  server.addService<DesktopServiceServer>(DesktopServiceService, {
    createDesktop: async ({ request, logger }) => {
      const { cluster, loginNode: host, wm, userId, desktopName, remoteControlTool } = request;
      await checkUserClusterPermission({ userId, clusterIds: cluster, logger });

      const maxDesktops: number = getDesktopConfig(cluster)?.maxDesktops || 0;

      const clusterops = getClusterOps(cluster);
      const clusters = configClusters;
      const loginNodes = clusters[cluster]?.loginNodes?.map(getLoginNode);
      if (!loginNodes) {
        throw clusterNotFound(cluster);
      }

      if (remoteControlTool === RemoteControlTool.SHADOWDESK) {
        // find if the user has running session on the target login node 确定现有的桌面是否超过了maxDesktops
        const listResp = await clusterops.desktop.listUserDesktops({ loginNode: host, userId }, logger);
        const desktopCount = listResp?.desktops?.length || 0;
        if (desktopCount >= maxDesktops) {
          throw {
            code: Status.RESOURCE_EXHAUSTED,
            message: "Too many desktops",
          } as ServiceError;
        }

        const createResp = await createShadowDesk(cluster, host, userId, desktopName || "", wm);

        let shadowdeskUrl: string = "";

        if (createResp.ok) {
          const resp = await createResp.json();
          shadowdeskUrl = String(resp?.data?.url);
        } else {
          return createResp.json().then((errorData) => {
            logger.error(`create shadowdesk desktop error: ${errorData}`);
            throw {
              code: Status.INTERNAL,
              message: `${JSON.stringify(errorData)}`,
            } as ServiceError;
          });
        }
        return [{ shadowdeskUrl, host: "", port: 0, password: "" }];
      } else {
        ensureEnabled(cluster);

        const availableWms = getDesktopConfig(cluster).wms;

        if (availableWms.find((x) => x.wm === wm) === undefined) {
          throw {
            code: Status.INVALID_ARGUMENT,
            message: `${wm} is not a acceptable wm.`,
          } as ServiceError;
        }

        checkLoginNodeInCluster(cluster, host);

        const clusterops = getClusterOps(cluster);

        const reply = await clusterops.desktop.createDesktop(
          { loginNode: host, wm, userId, desktopName: desktopName ?? "" },
          logger,
        );

        return [{ ...reply }];
      }
    },

    killDesktop: async ({ request, logger }) => {
      const { cluster, loginNode: host, displayId, userId, desktopInfo, id } = request;
      await checkActivatedClusters({ clusterIds: cluster });

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

      ensureEnabled(cluster);

      checkLoginNodeInCluster(cluster, host);

      const clusterops = getClusterOps(cluster);

      await clusterops.desktop.killDesktop(
        {
          loginNode: host,
          userId,
          id,
          displayId: desktopInfo?.desktop?.vnc.displayId || displayId,
        },
        logger,
      );

      return [{}];
    },

    connectToDesktop: async ({ request, logger }) => {
      const { cluster, loginNode: host, displayId, userId, desktopInfo, id } = request;
      await checkUserClusterPermission({ userId, clusterIds: cluster, logger });

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
              throw {
                code: Status.INTERNAL,
                message: `${JSON.stringify(errorData)}`,
              } as ServiceError;
            });
          }
        } else {
          throw {
            code: Status.NOT_FOUND,
            message: `ShadowDesk desktop ${desktopName} not found.`,
          } as ServiceError;
        }
        return [{ shadowdeskUrl, host: "", port: 0, password: "" }];
      } else {
        const clusterops = getClusterOps(cluster);

        const reply = await clusterops.desktop.connectToDesktop({ loginNode: host, userId, displayId, id }, logger);

        return [{ ...reply }];
      }
    },

    listUserDesktops: async ({ request, logger }) => {
      const { clusters, userId } = request;
      const clusterRequestMap = new Map<string, string[]>();
      clusters.forEach(({ cluster, loginNodes }) => {
        const clusterId = cluster.trim();
        if (!clusterId) {
          return;
        }

        const normalizedLoginNodes = Array.from(
          new Set(loginNodes.map((loginNode) => loginNode.trim()).filter((loginNode) => loginNode)),
        );
        const existingLoginNodes = clusterRequestMap.get(clusterId);
        if (!existingLoginNodes) {
          clusterRequestMap.set(clusterId, normalizedLoginNodes);
          return;
        }
        if (existingLoginNodes.length === 0 || normalizedLoginNodes.length === 0) {
          clusterRequestMap.set(clusterId, []);
          return;
        }

        clusterRequestMap.set(clusterId, Array.from(new Set([...existingLoginNodes, ...normalizedLoginNodes])));
      });

      const clusterRequests = Array.from(clusterRequestMap.entries()).map(([cluster, loginNodes]) => {
        return { cluster, loginNodes };
      });
      const clusterIds = clusterRequests.map(({ cluster }) => cluster);

      if (clusterIds.length === 0) {
        return [{ userDesktops: [] }];
      }

      await checkActivatedClusters({ clusterIds });

      const clusterResults = await Promise.allSettled(
        clusterRequests.map(async ({ cluster, loginNodes }) => {
          ensureEnabled(cluster);

          const availableWms = getDesktopConfig(cluster).wms;
          const clusterops = getClusterOps(cluster);

          const clusterLoginNodes =
            loginNodes.length > 0
              ? loginNodes.map((loginNode) => {
                  checkLoginNodeInCluster(cluster, loginNode);
                  return { address: loginNode };
                })
              : configClusters[cluster]?.loginNodes?.map(getLoginNode);
          if (!clusterLoginNodes) {
            throw clusterNotFound(cluster);
          }

          const results = await Promise.allSettled(
            clusterLoginNodes.map(async (loginNode) => {
              try {
                const reply = await clusterops.desktop.listUserDesktops(
                  {
                    loginNode: loginNode.address,
                    userId,
                  },
                  logger,
                );
                return {
                  ...reply,
                  cluster,
                  desktops: reply.desktops.map((desktop) => {
                    const wmInfo = availableWms.find((wm) => wm.wm === desktop.wm);

                    return {
                      ...desktop,
                      wm: wmInfo?.name ?? desktop.wm,
                      iconPath: wmInfo ? getWmIconPath(wmInfo) : undefined,
                    };
                  }),
                };
              } catch (error) {
                logger.warn(
                  `listUserDesktops failed cluster=${cluster} loginNode=${loginNode.address} userId=${userId} error=${error}`,
                );
                throw error;
              }
            }),
          );

          const userDesktops = results.flatMap((result, i) => {
            if (result.status === "rejected") {
              logger.warn(`Failed to list desktops for login node ${clusterLoginNodes[i].address}: ${result.reason}`);
              return [];
            }
            return [result.value];
          });

          return userDesktops;
        }),
      );

      const userDesktops = clusterResults
        .flatMap((result, i) => {
          if (result.status === "rejected") {
            logger.warn(`Failed to list desktops for cluster ${clusterIds[i]}: ${result.reason}`);
            return [];
          }
          return [result.value];
        })
        .flat();
      return [{ userDesktops }];
    },

    listAvailableWms: async ({ request, logger }) => {
      const { cluster, userId } = request;
      await checkUserClusterPermission({ userId, clusterIds: cluster, logger });

      ensureEnabled(cluster);

      const result = getDesktopConfig(cluster).wms;

      return [{ wms: result }];
    },
  });
});
