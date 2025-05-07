import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { ChargingServiceClient } from "@scow/protos/build/server/charging";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole, UserInfo, UserRole } from "src/models/User";
import { SearchType } from "src/pageComponents/common/PaymentTable";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

import { getTenantOfAccount } from "./charges";

export const PaymentInfo = Type.Object({
  index: Type.Number(),
  accountName: Type.Optional(Type.String()),
  time: Type.String(),
  type: Type.String(),
  amount: Type.Number(),
  comment: Type.String(),
  ipAddress: Type.String(),
  operatorId: Type.String(),
});
export type PaymentInfo = Static<typeof PaymentInfo>;

export const GetPaymentsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
     * @format date-time
     */
    startTime: Type.String({ format: "date-time" }),

    /**
     * @format date-time
     */
    endTime: Type.String({ format: "date-time" }),

    accountNames: Type.Optional(Type.Array(Type.String())),

    searchType: Type.Enum(SearchType),
    // 充值类型
    types:Type.Optional(Type.Array(Type.String())),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(PaymentInfo),
      total: Type.Number(),
    }),
  },
});

export const getPaymentRecordTarget = (
  searchType: SearchType,
  user: UserInfo,
  tenantOfAccount: string,
  targetNames: string[] | undefined,
) => {
  switch (searchType) {
    case SearchType.tenant:
      return targetNames
        ? { $case:"tenant" as const, tenant:{ tenantName:targetNames[0] } }
        : { $case:"allTenants" as const, allTenants:{ } };
    case SearchType.selfTenant:
      return { $case:"tenant" as const, tenant:{ tenantName:user.tenant } };
    case SearchType.selfAccount:
      return { $case:"accountsOfTenant" as const,
        accountsOfTenant:{ tenantName:user.tenant, accountNames:targetNames ?? []} };
    case SearchType.account:
      return targetNames
        ? { $case:"accountsOfTenant" as const,
          accountsOfTenant:{ tenantName:tenantOfAccount, accountNames:targetNames } }
        : { $case:"accountsOfTenant" as const, accountsOfTenant:{ tenantName:user.tenant, accountNames:[]} };
    default:
      break;
  }
};

export default route(GetPaymentsSchema, async (req, res) => {

  const { endTime, startTime, accountNames, searchType, types } = req.query;

  const client = getClient(ChargingServiceClient);

  let user: UserInfo | undefined;

  // check whether the user can access the account
  if (accountNames) {
    user = await authenticate((i) =>
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
      // 排除掉前面的租户财务员和管理员，只剩下账户管理员
      accountNames.length === 1 &&
      i.accountAffiliations.some((x) => x.accountName === accountNames[0] && x.role !== UserRole.USER),
    )(req, res);
    if (!user) { return; }
  } else {
    user = await authenticate((i) =>
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    )(req, res);
    if (!user) { return; }
  }

  const tenantOfAccount = await getTenantOfAccount(accountNames, user);

  const reply = ensureNotUndefined(await asyncClientCall(client, "getPaymentRecords", {
    target: getPaymentRecordTarget(searchType, user, tenantOfAccount, accountNames),
    startTime,
    endTime,
    types:types ?? [],
  }), ["total"]);

  const returnAuditInfo = user.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
          user.tenantRoles.includes(TenantRole.TENANT_ADMIN);

  const records = reply.results.map((x) => {
    const obj = ensureNotUndefined(x, ["time", "amount"]);

    return {
      accountName: obj.accountName,
      comment: obj.comment,
      index: obj.index,
      ipAddress: returnAuditInfo ? obj.ipAddress : "",
      operatorId: returnAuditInfo ? obj.operatorId : "",
      time: obj.time,
      type: obj.type,
      amount: moneyToNumber(obj.amount),
    } as PaymentInfo;
  });

  return {
    200: {
      results: records,
      total: moneyToNumber(reply.total),
    },
  };
});
