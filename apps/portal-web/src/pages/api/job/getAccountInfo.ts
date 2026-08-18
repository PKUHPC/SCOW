import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { moneyToNumber } from "@scow/lib-decimal";
import { libWebGetUserInfo } from "@scow/lib-web/build/server/userAccount";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getMisClient } from "src/utils/misClient";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";

export const GetAccountInfoSchema = typeboxRouteSchema({
  method: "GET",
  query: Type.Object({
    accountName: Type.String(),
  }),
  responses: {
    200: Type.Object({
      accountName: Type.String(),
      isInWhitelist: Type.Optional(Type.Boolean()),
      ownerName: Type.Optional(Type.String()),
      ownerId: Type.Optional(Type.String()),
      balance: Type.Number(),
      blockThresholdAmount: Type.Number(),
      jobChargeLimit: Type.Optional(Type.Number()),
      usedJobCharge: Type.Optional(Type.Number()),
    }),
    204: Type.Null(),
    403: Type.Null(),
  },
});

const auth = authenticate(() => true);

export default route(GetAccountInfoSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const { accountName } = req.query;

  const userInfo = await libWebGetUserInfo(
    info.identityId, publicConfig.MIS_SERVER_URL, runtimeConfig.SCOW_API_AUTH_TOKEN,
  );
  if (!userInfo) {
    return { 204: null };
  }

  if (!userInfo.affiliations.some((a) => a.accountName === accountName)) {
    return { 403: null };
  }

  const accountClient = getMisClient(AccountServiceClient);
  const userClient = getMisClient(UserServiceClient);

  const [accountReply, userStatusReply] = await Promise.all([
    asyncClientCall(accountClient, "getAccounts", { accountName }),
    asyncClientCall(userClient, "getUserStatus", {
      userId: info.identityId,
      tenantName: userInfo.tenantName,
      accountNames: [accountName],
    }),
  ]);

  const account = accountReply.results[0];
  if (!account) {
    return { 204: null };
  }

  const accountStatus = userStatusReply.accountStatuses[accountName];
  const blockThresholdAmount = account.blockThresholdAmount ?? account.defaultBlockThresholdAmount;

  return {
    200: {
      accountName: account.accountName,
      isInWhitelist: account.isInWhitelist ?? undefined,
      ownerName: account.ownerName ?? undefined,
      ownerId: account.ownerId ?? undefined,
      balance: account.balance ? moneyToNumber(account.balance) : 0,
      blockThresholdAmount: blockThresholdAmount ? moneyToNumber(blockThresholdAmount) : 0,
      jobChargeLimit: accountStatus?.jobChargeLimit ? moneyToNumber(accountStatus.jobChargeLimit) : undefined,
      usedJobCharge: accountStatus?.usedJobCharge ? moneyToNumber(accountStatus.usedJobCharge) : undefined,
    },
  };
});
