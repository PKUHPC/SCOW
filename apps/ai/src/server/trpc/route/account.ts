import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { getCommonConfig } from "@scow/config/src/common";
import { libGetAccounts } from "@scow/lib-server";
import { libWebGetAppForbiddenAccounts } from "@scow/lib-web/build/server/appAuthorization";
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
    .input(
      z.object({
        clusterId: z.optional(z.string()),
        useForCreateApp: z.optional(z.boolean()),
        appId: z.optional(z.string()),
        ...paginationSchema.shape,
      }),
    )
    .output(z.object({ accounts: z.array(z.string()), count: z.number() }))
    .query(async ({ input, ctx: { user } }) => {
      const { clusterId, useForCreateApp, appId, page, pageSize } = input;

      const currentClusterIds = await getCurrentClusters(user.identityId);

      if (!clusterId || !currentClusterIds.includes(clusterId)) {
        return { accounts: [], count: 0 };
      }

      const commonConfig = getCommonConfig();

      let appForbiddenAccounts: string[] = [];
      // 如果部署了管理系统且开启了授权应用功能
      // 当在创建交互式应用时查询可用账户时，需要过滤掉此应用未授权的账户
      if (
        config.MIS_DEPLOYED &&
        config.MIS_SERVER_URL &&
        commonConfig.allowAppAuthorization &&
        useForCreateApp &&
        appId
      ) {
        appForbiddenAccounts = await libWebGetAppForbiddenAccounts(
          clusterId,
          appId,
          config.MIS_SERVER_URL,
          commonConfig.scowApi?.auth?.token,
        );
      }

      // 判断是否已部署管理系统，如果是则调用管理系统数据库，返回可用账户列表
      if (config.MIS_DEPLOYED && commonConfig.scowApi?.auth?.token) {
        const userUnblockedAccounts = await libGetAccounts(
          logger,
          user.identityId,
          AccountStatusFilter.UNBLOCKED_ONLY,
          config.MIS_SERVER_URL,
          commonConfig.scowApi.auth.token,
        );

        const { paginatedItems: paginatedAccounts, totalCount } = paginate(
          userUnblockedAccounts.accounts,
          page,
          pageSize,
        );

        const filteredAccounts = paginatedAccounts.filter((a) => !appForbiddenAccounts.includes(a));
        return { accounts: filteredAccounts, count: totalCount };
      }

      const client = getAdapterClient(clusterId);
      if (!client) {
        throw clusterNotFound(clusterId);
      }
      const { accounts } = await asyncClientCall(client.account, "listAccounts", { userId: user.identityId });

      const filteredAccounts = accounts.filter((a) => !appForbiddenAccounts.includes(a));

      const { paginatedItems: paginatedAccounts, totalCount } = paginate(filteredAccounts, page, pageSize);

      return { accounts: paginatedAccounts, count: totalCount };
    }),
});
