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

import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { getCommonConfig } from "@scow/config/src/common";
import { libGetAccounts } from "@scow/lib-server";
import { AccountStatusFilter } from "@scow/protos/build/portal/job";
import { config } from "src/server/config/env";
import { router } from "src/server/trpc/def";
import { procedure } from "src/server/trpc/procedure/base";
import { getAdapterClient } from "src/server/utils/clusters";
import { clusterNotFound } from "src/server/utils/errors";
import { logger } from "src/server/utils/logger";
import { paginate, paginationSchema } from "src/server/utils/pagination";
import { z } from "zod";

import { getCurrentClusters } from "../../utils/clusters";

export const accountRouter = router({

  listAccounts: procedure
    .meta({
      openapi: {
        method: "GET",
        path: "/accounts",
        tags: ["account"],
        summary: "List all accounts",
      },
    })
    .input(z.object({
      clusterId: z.optional(z.string()),
      ...paginationSchema.shape,
    }))
    .output(z.object({ accounts: z.array(z.string()), count: z.number() }))
    .query(async ({ input, ctx: { user } }) => {
      const { clusterId, page, pageSize } = input;

      const currentClusterIds = await getCurrentClusters(user.identityId);

      if (!clusterId || !currentClusterIds.includes(clusterId)) {
        return { accounts: [], count: 0 };
      }

      // 判断是否已部署管理系统，如果是则调用管理系统数据库，返回可用账户列表
      const commonConfig = getCommonConfig();
      if (config.MIS_DEPLOYED && commonConfig.scowApi?.auth?.token) {
        const userUnblockedAccounts = await libGetAccounts(logger,
          user.identityId,
          AccountStatusFilter.UNBLOCKED_ONLY,
          config.MIS_SERVER_URL,
          commonConfig.scowApi.auth.token,
        );

        const { paginatedItems: paginatedAccounts, totalCount } = paginate(
          userUnblockedAccounts.accounts, page, pageSize,
        );
        return { accounts: paginatedAccounts, count: totalCount };

      }

      const client = getAdapterClient(clusterId);
      if (!client) {
        throw clusterNotFound(clusterId);
      }
      const { accounts } = await asyncClientCall(client.account, "listAccounts", { userId: user.identityId });

      const { paginatedItems: paginatedAccounts, totalCount } = paginate(
        accounts, page, pageSize,
      );

      return { accounts: paginatedAccounts, count: totalCount };

    }),
});
