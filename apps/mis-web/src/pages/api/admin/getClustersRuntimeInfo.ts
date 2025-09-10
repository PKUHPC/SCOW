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
import { ClusterRuntimeInfo, ClusterRuntimeInfoSchema } from "@scow/config/build/type";
import { ConfigServiceClient } from "@scow/protos/build/server/config";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { validateToken } from "src/auth/token";
import { getClusterConfigFiles } from "src/server/clusterConfig";
import { getClient } from "src/utils/client";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";

export const GetClustersRuntimeInfoSchema = typeboxRouteSchema({

  method: "GET",

  // only set the token query when firstly used in getInitialProps
  query: Type.Object({
    token: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(ClusterRuntimeInfoSchema),
    }),

    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export const getClustersRuntimeInfo = async () => {
  const client = getClient(ConfigServiceClient);
  const result = await asyncClientCall(client, "getClustersRuntimeInfo", {});
  const operatorIds = Array.from(new Set(result.results.map((x) => {
    const lastActivationOperation = x.lastActivationOperation!;
    return lastActivationOperation?.operatorId ?? undefined;
  })));

  const userIds = operatorIds.filter((id) => typeof id === "string" && id !== undefined && id !== null);

  const userClient = getClient(UserServiceClient);
  const { users } = await asyncClientCall(userClient, "getUsersByIds", {
    userIds,
  });

  const userMap = new Map(users.map((x) => [x.userId, x.userName]));

  const clusterConfigs = await getClusterConfigFiles();

  const clustersDatabaseInfo: ClusterRuntimeInfo[] = result.results.map((x) => {
    const lastActivationOperation = x.lastActivationOperation!;
    return {
      ...x,
      operatorId: lastActivationOperation?.operatorId ?? "",
      operatorName: lastActivationOperation?.operatorId ? userMap.get(lastActivationOperation?.operatorId) : "",
      deactivationComment: lastActivationOperation?.deactivationComment ?? "",
      hpcEnabled: clusterConfigs[x.clusterId]?.hpc?.enabled,
    };
  });

  return clustersDatabaseInfo;
};

export default route(GetClustersRuntimeInfoSchema,
  async (req, res) => {

    // if not initialized, every one can get clustersRuntimeInfo
    if (await queryIfInitialized()) {

      const { token } = req.query;
      // when firstly used in getInitialProps, check the token
      // when logged in, use auth()
      const info = token ? await validateToken(token) : await auth(req, res);
      if (!info) { return { 403: null }; }
    }

    return {
      200: {
        results: await getClustersRuntimeInfo(),
      },
    };
  });
