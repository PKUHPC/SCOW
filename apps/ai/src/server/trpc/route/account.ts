import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { getCommonConfig } from "@scow/config/src/common";
import { moneyToNumber } from "@scow/lib-decimal";
import { getClientFn } from "@scow/lib-server";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { TRPCError } from "@trpc/server";
import { config } from "src/server/config/env";
import { router } from "src/server/trpc/def";
import { procedure } from "src/server/trpc/procedure/base";
import { z } from "zod";

const AccountInfoSchema = z.object({
  accountName: z.string(),
  isInWhitelist: z.boolean().optional(),
  ownerName: z.string().optional(),
  ownerId: z.string().optional(),
  balance: z.number(),
  blockThresholdAmount: z.number(),
  jobChargeLimit: z.number().optional(),
  usedJobCharge: z.number().optional(),
});

export const accountRouter = router({
  getAccountInfo: procedure
    .meta({
      openapi: {
        method: "GET",
        path: "/accounts/{accountName}/info",
        tags: ["account"],
        summary: "Get current user's account info",
      },
    })
    .input(z.object({ accountName: z.string() }))
    .output(AccountInfoSchema.nullable())
    .query(async ({ input, ctx: { user } }) => {
      const commonConfig = getCommonConfig();

      if (!config.MIS_DEPLOYED || !config.MIS_SERVER_URL) {
        return null;
      }

      const { accountName } = input;
      const userInfo = await libWebGetUserInfo(
        user.identityId,
        config.MIS_SERVER_URL,
        commonConfig.scowApi?.auth?.token,
      );

      if (!userInfo) {
        return null;
      }

      if (!userInfo.affiliations.some((affiliation) => affiliation.accountName === accountName)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `User ${user.identityId} is not in account ${accountName}`,
        });
      }

      const getMisClient = getClientFn(config.MIS_SERVER_URL, commonConfig.scowApi?.auth?.token);
      const accountClient = getMisClient(AccountServiceClient);
      const userClient = getMisClient(UserServiceClient);

      const [accountReply, userStatusReply] = await Promise.all([
        asyncClientCall(accountClient, "getAccounts", { accountName }),
        asyncClientCall(userClient, "getUserStatus", {
          userId: user.identityId,
          tenantName: userInfo.tenantName,
          accountNames: [accountName],
        }),
      ]);

      const account = accountReply.results[0];
      if (!account) {
        return null;
      }

      const accountStatus = userStatusReply.accountStatuses[accountName];
      const blockThresholdAmount = account.blockThresholdAmount ?? account.defaultBlockThresholdAmount;

      return {
        accountName: account.accountName,
        isInWhitelist: account.isInWhitelist ?? undefined,
        ownerName: account.ownerName ?? undefined,
        ownerId: account.ownerId ?? undefined,
        balance: account.balance ? moneyToNumber(account.balance) : 0,
        blockThresholdAmount: blockThresholdAmount ? moneyToNumber(blockThresholdAmount) : 0,
        jobChargeLimit: accountStatus?.jobChargeLimit ? moneyToNumber(accountStatus.jobChargeLimit) : undefined,
        usedJobCharge: accountStatus?.usedJobCharge ? moneyToNumber(accountStatus.usedJobCharge) : undefined,
      };
    }),
});
