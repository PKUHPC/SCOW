import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { ChargingServiceClient, GetPaymentRecordsRequest_SortBy as SortBy } from "@scow/protos/build/server/charging";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PaymentSortBy } from "src/models/payment";
import { ChargesSortOrder, TenantRole, UserInfo, UserRole } from "src/models/User";
import { SearchType } from "src/pageComponents/common/PaymentTable";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

import { getTenantOfAccount } from "./charges";

export const mapChargesSortByType = {
  accountName: SortBy.ACCOUNT_NAME,
  time: SortBy.TIME,
  amount: SortBy.AMOUNT,
  type: SortBy.TYPE,
  ipAddress: SortBy.IP_ADDRESS,
  operatorId: SortBy.OPERATOR_ID,
  comment: SortBy.COMMENT,
} as Record<string, SortBy>;

export const mapChargesSortOrderType = {
  descend: SortOrder.DESCEND,
  ascend: SortOrder.ASCEND,
} as Record<string, SortOrder>;

export const PaymentInfo = Type.Object({
  index: Type.Number(),
  accountName: Type.Optional(Type.String()),
  time: Type.String(),
  type: Type.String(),
  amount: Type.Number(),
  ownerId: Type.Optional(Type.String()),
  ownerName: Type.Optional(Type.String()),
  comment: Type.String(),
  ipAddress: Type.String(),
  operatorId: Type.String(),
  operatorName: Type.String(),
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
    types: Type.Optional(Type.Array(Type.String())),

    ownerIdOrName: Type.Optional(Type.String()),

    operatorIdOrName: Type.Optional(Type.String()),

    page: Type.Optional(Type.Integer({ minimum: 1 })),

    pageSize: Type.Optional(Type.Integer()),

    sortBy: Type.Optional(PaymentSortBy),

    sortOrder: Type.Optional(ChargesSortOrder),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(PaymentInfo),
      total: Type.Number(),
      totalCount: Type.Number(),
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
        ? { $case: "tenant" as const, tenant: { tenantName: targetNames[0] } }
        : { $case: "allTenants" as const, allTenants: {} };
    case SearchType.selfTenant:
      return { $case: "tenant" as const, tenant: { tenantName: user.tenant } };
    case SearchType.selfAccount:
      return {
        $case: "accountsOfTenant" as const,
        accountsOfTenant: { tenantName: user.tenant, accountNames: targetNames ?? [] },
      };
    case SearchType.account:
      return targetNames
        ? {
            $case: "accountsOfTenant" as const,
            accountsOfTenant: { tenantName: tenantOfAccount, accountNames: targetNames },
          }
        : { $case: "accountsOfTenant" as const, accountsOfTenant: { tenantName: user.tenant, accountNames: [] } };
    default:
      break;
  }
};

export default route(GetPaymentsSchema, async (req, res) => {
  const {
    endTime,
    startTime,
    accountNames,
    searchType,
    types,
    ownerIdOrName,
    operatorIdOrName,
    page,
    pageSize,
    sortBy,
    sortOrder,
  } = req.query;

  if (searchType === SearchType.selfAccount && (!accountNames || accountNames.length === 0)) {
    res.status(400).end();
    return;
  }

  const client = getClient(ChargingServiceClient);

  let user: UserInfo | undefined;

  // check whether the user can access the account
  if (accountNames && accountNames.length > 0) {
    user = await authenticate(
      (i) =>
        i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
        i.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
        // 排除掉前面的租户财务员和管理员，只剩下账户管理员
        (accountNames.length === 1 &&
          i.accountAffiliations.some((x) => x.accountName === accountNames[0] && x.role !== UserRole.USER)),
    )(req, res);
    if (!user) {
      return;
    }
  } else {
    user = await authenticate(
      (i) => i.tenantRoles.includes(TenantRole.TENANT_FINANCE) || i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    )(req, res);
    if (!user) {
      return;
    }
  }

  const tenantOfAccount = await getTenantOfAccount(accountNames, user);

  // 默认按照时间的倒序排序
  const mapChargesSortBy = sortBy ? mapChargesSortByType[sortBy] : mapChargesSortByType.time;
  const mapChargesSortOrder = sortOrder ? mapChargesSortOrderType[sortOrder] : mapChargesSortOrderType.descend;

  const reply = ensureNotUndefined(
    await asyncClientCall(client, "getPaymentRecords", {
      target: getPaymentRecordTarget(searchType, user, tenantOfAccount, accountNames),
      startTime,
      endTime,
      ownerIdOrName,
      operatorIdOrName,
      page,
      pageSize,
      sortBy: mapChargesSortBy,
      sortOrder: mapChargesSortOrder,
      types: types ?? [],
    }),
    ["total"],
  );

  const returnAuditInfo =
    user.tenantRoles.includes(TenantRole.TENANT_FINANCE) || user.tenantRoles.includes(TenantRole.TENANT_ADMIN);

  const records = reply.results.map((x) => {
    const obj = ensureNotUndefined(x, ["time", "amount"]);

    return {
      accountName: obj.accountName,
      comment: obj.comment,
      index: obj.index,
      ipAddress: returnAuditInfo ? obj.ipAddress : "",
      operatorId: returnAuditInfo ? obj.operatorId : "",
      operatorName: returnAuditInfo ? obj.operatorName : "",
      time: obj.time,
      type: obj.type,
      ownerId: obj.ownerId,
      ownerName: obj.ownerName,
      amount: moneyToNumber(obj.amount),
    } as PaymentInfo;
  });

  return {
    200: {
      results: records,
      totalCount: reply.totalCount || 0,
      total: moneyToNumber(reply.total),
    },
  };
});
