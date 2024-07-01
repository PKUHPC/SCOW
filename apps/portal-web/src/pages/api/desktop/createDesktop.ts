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
import { status } from "@grpc/grpc-js";
import { OperationType } from "@scow/lib-operation-log";
import { DesktopServiceClient } from "@scow/protos/build/portal/desktop";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { getLoginDesktopEnabled } from "src/utils/cluster";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const CreateDesktopSchema = typeboxRouteSchema({
  method: "POST",

  body: Type.Object({
    cluster: Type.String(),
    loginNode: Type.String(),

    // the name of the wm
    wm: Type.String(),

    // the name of the desktop
    desktopName: Type.String(),
  }),

  responses: {
    200: Type.Object({
      host: Type.String(),
      port: Type.Number(),
      password: Type.String(),
    }),

    400: Type.Object({
      code: Type.Union([Type.Literal("INVALID_WM"), Type.Literal("INVALID_CLUSTER")]),
    }),

    409: Type.Object({
      code: Type.Literal("TOO_MANY_DESKTOPS"),
    }),

    // 功能没有启用
    501: Type.Object({ code: Type.Literal("CLUSTER_LOGIN_DESKTOP_NOT_ENABLED") }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/route(CreateDesktopSchema, async (req, res) => {

  const { cluster, loginNode, wm, desktopName } = req.body;

  const clusterConfigs = await getClusterConfigFiles();
  const loginDesktopEnabled = getLoginDesktopEnabled(cluster, clusterConfigs);

  if (!loginDesktopEnabled) {
    return { 501: { code: "CLUSTER_LOGIN_DESKTOP_NOT_ENABLED" as const } };
  }
  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(DesktopServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.createDesktop,
    operationTypePayload:{
      desktopName, wm, clusterId: cluster, loginNode,
    },
  };

  return await asyncUnaryCall(client, "createDesktop", {
    cluster, loginNode, userId: info.identityId, wm, desktopName,
  }).then(
    async ({ host, password, port }) => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 200: { host, password, port } };
    },
    handlegRPCError({
      [status.NOT_FOUND]: () => ({ 400: { code: "INVALID_CLUSTER" as const } }),
      [status.INVALID_ARGUMENT]: () => ({ 400: { code: "INVALID_WM" as const } }),
      [status.RESOURCE_EXHAUSTED]: () => ({ 409: { code: "TOO_MANY_DESKTOPS" as const } }),
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));

});
