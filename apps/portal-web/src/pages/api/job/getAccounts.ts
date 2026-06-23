import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AppScope, libWebGetAppForbiddenAccounts } from "@scow/lib-web/build/server/appAuthorization";
import { JobServiceClient } from "@scow/protos/build/portal/job";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AccountStatusFilter } from "src/models/job";
import { getClient } from "src/utils/client";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const GetAccountsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    statusFilter: Type.Optional(Type.Enum(AccountStatusFilter)),
    useForCreateApp: Type.Optional(Type.Boolean()),
    appId: Type.Optional(Type.String()),
  }),

  responses: {
    200: Type.Object({
      accounts: Type.Array(Type.String()),
    }),
    404: Type.Object({
      code: Type.Literal("ACCOUNT_NOT_FOUND"),
      message: Type.String(),
    }),
  },
});
const auth = authenticate(() => true);

export default route(GetAccountsSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster, statusFilter, useForCreateApp, appId } = req.query;

  const client = getClient(JobServiceClient);

  let appForbiddenAccounts: string[] = [];
  // 如果部署了管理系统且开启了授权应用功能
  // 当在创建应用时查询可用账户时，需要过滤掉此应用未授权的账户
  if (
    publicConfig.MIS_DEPLOYED &&
    publicConfig.MIS_SERVER_URL &&
    publicConfig.ALLOW_APP_AUTHORIZATION &&
    useForCreateApp &&
    appId
  ) {
    appForbiddenAccounts = await libWebGetAppForbiddenAccounts(
      cluster,
      appId,
      publicConfig.MIS_SERVER_URL,
      runtimeConfig.SCOW_API_AUTH_TOKEN,
      AppScope.HPC,
    );
  }

  const result = asyncUnaryCall(client, "listAccounts", {
    cluster,
    userId: info.identityId,
    statusFilter,
  }).then(
    ({ accounts }) => {
      const filteredAccounts = accounts.filter((accountName) => !appForbiddenAccounts.includes(accountName));
      return { 200: { accounts: filteredAccounts } };
    },
    handlegRPCError({
      [status.NOT_FOUND]: (err) => ({ 404: { code: "ACCOUNT_NOT_FOUND", message: err.details } }) as const,
      [status.INTERNAL]: (err) => ({ 404: { code: "ACCOUNT_NOT_FOUND", message: err.details } }) as const,
    }),
  );

  return result;
});
