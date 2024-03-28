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
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

import { Partition } from "../cluster";

export const GetAvailablePartitionsForClusterSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    accountName: Type.String(),
  }),

  responses: {
    200: Type.Object({
      partitions: Type.Array(Partition),
    }),
  },
});
const auth = authenticate(() => true);

export default route(GetAvailablePartitionsForClusterSchema, async (req, res) => {


  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster, accountName } = req.query;

  const client = getClient(ConfigServiceClient);

  return asyncUnaryCall(client, "getAvailablePartitionsForCluster", {
    cluster, accountName, userId: info.identityId,
  }).then(({ partitions }) => ({ 200: { partitions: partitions } }));

});
