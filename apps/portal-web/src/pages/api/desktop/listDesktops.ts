/**
 * Copyright (c) 2022 Peking University and Peking University Institute for Computing and Digital Economy
 * SCOW is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *          http://license.coscl.org.cn/MulanPSL2
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { RemoteControlTool } from "@scow/protos/build/portal/desktop";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";

export const ListDesktopsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    loginNode: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      userDesktops: Type.Array(Type.Object({
        host: Type.String(),
        desktops: Type.Array(Type.Object({
          type: Type.Union([Type.Literal("vnc"), Type.Literal("shadowdesk")]),
          vnc: Type.Optional(Type.Object({
            displayId: Type.Number(),
            desktopName: Type.String(),
            wm: Type.String(),
            createTime: Type.Optional(Type.String()),
          })),
          shadowdesk: Type.Optional(
            Type.Object({
              displayId: Type.Number(),
              desktopName: Type.String(),
              wm: Type.String(),
              createTime: Type.Optional(Type.String()),
            })),
        })),
      })),
    }),

    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(ListDesktopsSchema, async (req, res) => {

  const { cluster, loginNode } = req.query;

  const clusterConfigs = await getClusterConfigFiles();

  const loginDesktopEnabled = getLoginDesktopEnabled(cluster, clusterConfigs);
  if (!loginDesktopEnabled) {
    return { 501: { code: "CLUSTER_LOGIN_DESKTOP_NOT_ENABLED" as const } };
  }

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(DesktopServiceClient);

  return await asyncUnaryCall(client, "listUserDesktops", {
    cluster, loginNode, userId: info.identityId,
  }).then(async ({ userDesktops }) => {
    return {
      200: {
        userDesktops: [{
          host: userDesktops[0].host,
          desktops: userDesktops[0].desktops?.map((desktop) => {
            if (desktop.remoteControlTool === RemoteControlTool.SHADOWDESK) {
              return {
                type: "shadowdesk" as const,
                shadowdesk: {
                  displayId: desktop.displayId,
                  desktopName: desktop.desktopName,
                  wm: desktop.wm,
                  createTime: desktop.createTime,
                },
              };
            } else {
              return {
                type: "vnc" as const,
                vnc: {
                  displayId: desktop.displayId,
                  desktopName: desktop.desktopName,
                  wm: desktop.wm,
                  createTime: desktop.createTime,
                },
              };
            }
          }),
        }],
      } };
  });

});
