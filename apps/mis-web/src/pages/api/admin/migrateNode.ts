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
import { OperationType } from "@scow/lib-operation-log";
import { ConfigServiceClient } from "@scow/protos/build/server/config";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const MigrateNodeSchema = typeboxRouteSchema({

  method: "PATCH",

  body: Type.Object({
    nodeName: Type.String(),
    originCluster: Type.String(),
    destinationCluster: Type.String(),
  }),

  responses: {
    /** 迁移成功 */
    204: Type.Null(),

    // 节点已在某集群上线
    409: Type.Object({ message: Type.String() }),

    /** 迁移失败 */
    500: Type.Object({ message: Type.String() }),

    /** 本功能在当前配置下不可用。 */
    501: Type.Object({ message: Type.String() }),
  },
});


export default route(MigrateNodeSchema,
  async (req, res) => {

    const { nodeName, originCluster, destinationCluster }
     = req.body;

    const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

    const info = await auth(req, res);

    if (!info) {
      return;
    }

    const logInfo = {
      operatorUserId: info.identityId,
      operatorIp: parseIp(req) ?? "",
      operationTypeName: OperationType.migrateNode,
      operationTypePayload:{
        nodeName,
        originCluster,
        destinationCluster,
      },
    };

    const client = getClient(ConfigServiceClient);

    return await asyncClientCall(client, "migrateNode", {
      nodeName,
      originCluster,
      destinationCluster,
    }).then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
      .catch(handlegRPCError({
        [Status.FAILED_PRECONDITION]: (e) => ({ 409: { message: e.details } }),
        [Status.INTERNAL]: (e) => ({ 500: { message: e.details } }),
        [Status.UNIMPLEMENTED]: (e) => ({ 501:{ message: e.details } }),
      },
      async () => await callLog(logInfo, OperationResult.FAIL),
      ));

  });
