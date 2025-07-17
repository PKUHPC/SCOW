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
import { ConfigServiceClient } from "@scow/protos/build/common/config";
import { NodeInfo_NodeState } from "@scow/protos/build/portal/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const NodeInfo = Type.Object({
  nodeName: Type.String(),
  partitions: Type.Array(Type.String()),
  state: Type.Enum(NodeInfo_NodeState),
  cpuCoreCount: Type.Number(),
  allocCpuCoreCount: Type.Number(),
  idleCpuCoreCount: Type.Number(),
  totalMemMb: Type.Number(),
  allocMemMb: Type.Number(),
  idleMemMb: Type.Number(),
  gpuCount: Type.Number(),
  allocGpuCount: Type.Number(),
  idleGpuCount: Type.Number(),
});

export type NodeInfo = Static<typeof NodeInfo>;

export const GetClusterNodesInfoSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    nodeNames: Type.Optional(Type.Array(Type.String())),
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      nodeInfo: Type.Array(NodeInfo),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetClusterNodesInfoSchema, async (req, res) => {

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster,nodeNames } = req.query;

  const client = getClient(ConfigServiceClient);

  const reply = await asyncUnaryCall(client, "getClusterNodesInfo", {
    cluster,
    nodeNames: nodeNames || [],
  });

  return { 200: { nodeInfo: reply.nodes } };

});
