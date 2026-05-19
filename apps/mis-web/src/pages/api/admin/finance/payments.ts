import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { ChargingServiceClient, GetPaymentRecordsRequest_SortBy as SortBy } from "@scow/protos/build/server/charging";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PaymentSortBy } from "src/models/payment";
import { ChargesSortOrder, PlatformRole } from "src/models/User";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

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

export const TenantPaymentInfo = Type.Object({
  index: Type.Number(),
  tenantName: Type.String(),
  time: Type.String(),
  type: Type.String(),
  amount: Type.Number(),
  comment: Type.String(),
  ipAddress: Type.String(),
  operatorId: Type.String(),
  operatorName: Type.String(),
});

export type TenantPaymentInfo = Static<typeof TenantPaymentInfo>;

export const GetTenantPaymentsSchema = typeboxRouteSchema({
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

    tenantName: Type.Optional(Type.String()),

    // 充值类型
    types: Type.Optional(Type.Array(Type.String())),

    operatorIdOrName: Type.Optional(Type.String()),

    page: Type.Optional(Type.Integer({ minimum: 1 })),

    pageSize: Type.Optional(Type.Integer()),

    sortBy: Type.Optional(PaymentSortBy),

    sortOrder: Type.Optional(ChargesSortOrder),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(TenantPaymentInfo),
      total: Type.Number(),
      totalCount: Type.Number(),
    }),
  },
});

export default route(GetTenantPaymentsSchema, async (req, res) => {
  const { endTime, startTime, tenantName, types, operatorIdOrName, page, pageSize, sortBy, sortOrder } = req.query;

  const client = getClient(ChargingServiceClient);

  const user = await authenticate(
    (i) =>
      i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) || i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN),
  )(req, res);
  if (!user) {
    return;
  }

  // 默认按照时间的倒序排序
  const mapChargesSortBy = sortBy ? mapChargesSortByType[sortBy] : mapChargesSortByType.time;
  const mapChargesSortOrder = sortOrder ? mapChargesSortOrderType[sortOrder] : mapChargesSortOrderType.descend;

  const reply = ensureNotUndefined(
    await asyncClientCall(client, "getPaymentRecords", {
      target: tenantName
        ? { $case: "tenant", tenant: { tenantName: tenantName } }
        : { $case: "allTenants", allTenants: {} },
      startTime,
      endTime,
      operatorIdOrName,
      page,
      pageSize,
      sortBy: mapChargesSortBy,
      sortOrder: mapChargesSortOrder,
      types: types ?? [],
    }),
    ["total"],
  );

  const tenants = reply.results.map((x) => {
    const obj = ensureNotUndefined(x, ["time", "amount"]);

    return {
      tenantName: obj.tenantName,
      comment: obj.comment,
      index: obj.index,
      ipAddress: obj.ipAddress,
      operatorId: obj.operatorId,
      operatorName: obj.operatorName,
      time: obj.time,
      type: obj.type,
      amount: moneyToNumber(obj.amount),
    } as TenantPaymentInfo;
  });

  return {
    200: {
      results: tenants,
      totalCount: reply.totalCount || 0,
      total: moneyToNumber(reply.total),
    },
  };
});
