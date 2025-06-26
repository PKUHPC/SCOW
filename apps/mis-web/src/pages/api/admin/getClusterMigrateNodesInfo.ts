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
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { ConfigServiceClient } from "@scow/protos/build/server/config";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { MigrateNodeInfoSchema } from "src/models/cluster";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const GetClusterMigrateNodesInfoSchema = typeboxRouteSchema({

  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    nodeNames: Type.Optional(Type.Array(Type.String())),
  }),

  responses: {
    // 获取节点成功
    200: Type.Object({
      nodes: Type.Array(MigrateNodeInfoSchema),// 后续还要考虑能够迁移到哪个集群的哪些分区
    }),

    /** 输入了多个节点名 */
    400: Type.Object({ message: Type.String() }),

    /** 输入了不存在的节点或配置了不存在的集群 */
    404: Type.Object({ message: Type.String() }),

    /** 适配器版本需要更新 */
    409: Type.Object({ message: Type.String() }),

    /** 未知原因的获取失败 */
    500: Type.Object({ message: Type.String() }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(GetClusterMigrateNodesInfoSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const client = getClient(ConfigServiceClient);

    const { cluster, nodeNames } = req.query;

    return await asyncClientCall(client, "getClusterMigrateNodesInfo",
      { cluster, nodeNames: nodeNames ?? []}).then(async ({ nodes }) => {
      const nodesWithCluster = nodes.map((node) => ({
        ...node,
        cluster,
      }));

      return {
        200: { nodes: nodesWithCluster },
      };
    })
      .catch(handlegRPCError({
        [Status.INVALID_ARGUMENT]: (e) => ({ 400: { message: e.details } }),
        [Status.FAILED_PRECONDITION]: (e) => ({ 409: { message: e.details } }),
        [Status.UNKNOWN]: (e) => ({ 500: { message: e.details } }),
      },
      )); ;

  });
