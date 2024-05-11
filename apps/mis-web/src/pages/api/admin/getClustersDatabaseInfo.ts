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
import { ClusterDatabaseInfo, ClusterDatabaseInfoSchema } from "@scow/config/build/type";
import { ClusterDatabaseInfo_LastActivationOperation, ConfigServiceClient } from "@scow/protos/build/server/config";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { getClient } from "src/utils/client";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const GetClustersDatabaseInfoSchema = typeboxRouteSchema({

  method: "GET",

  responses: {
    200: Type.Object({
      results: Type.Array(ClusterDatabaseInfoSchema),
    }),

  },
});

export default route(GetClustersDatabaseInfoSchema,
  async () => {

    const client = getClient(ConfigServiceClient);
    const result = await asyncClientCall(client, "getClustersDatabaseInfo", {});

    const operatorIds = Array.from(new Set(result.results.map((x) => {
      const lastActivationOperation = x.lastActivationOperation as ClusterDatabaseInfo_LastActivationOperation;
      return lastActivationOperation?.operatorId ?? undefined;
    })));

    const userIds = operatorIds.filter((id) => typeof id === "string" && id !== undefined && id !== null) as string[];

    const userClient = getClient(UserServiceClient);
    const { users } = await asyncClientCall(userClient, "getUsersByIds", {
      userIds,
    });

    const userMap = new Map(users.map((x) => [x.userId, x.userName]));

    const clustersDatabaseInfo: ClusterDatabaseInfo[] = result.results.map((x) => {
      const lastActivationOperation = x.lastActivationOperation as ClusterDatabaseInfo_LastActivationOperation;

      return {
        ...x,
        operatorId: lastActivationOperation?.operatorId ?? "",
        operatorName: lastActivationOperation?.operatorId ? userMap.get(lastActivationOperation?.operatorId) : "",
        deactivationComment: lastActivationOperation?.deactivationComment ?? "",
        hpcEnabled: runtimeConfig.CLUSTERS_CONFIG[x.clusterId].hpc.enabled,
      };
    });

    return {
      200: {
        results: clustersDatabaseInfo,
      },
    };
  });
