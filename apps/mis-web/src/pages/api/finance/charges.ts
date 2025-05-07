import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { SortOrder } from "@scow/protos/build/common/sort_order";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { AccountOfTenantTarget, AccountsOfAllTenantsTarget, AccountsOfTenantTarget, AllTenantsTarget,
  ChargingServiceClient,
  GetPaginatedChargeRecordsRequest_SortBy as SortBy, TenantTarget } from "@scow/protos/build/server/charging";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { ChargesSortBy, ChargesSortOrder, PlatformRole, SearchType, TenantRole,
  UserInfo, UserRole } from "src/models/User";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const MetadataMap = Type.Record(
  Type.String(),
  Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null(),
  ]),
);
export type MetadataMapType = Static<typeof MetadataMap>;

export const mapChargesSortByType = {
  "userId":SortBy.USER_ID,
  "time":SortBy.TIME,
  "amount":SortBy.AMOUNT,
  "type":SortBy.TYPE,
} as Record<string, SortBy>;

export const mapChargesSortOrderType = {
  "descend":SortOrder.DESCEND,
  "ascend":SortOrder.ASCEND,
} as Record<string, SortOrder>;

export const ChargeInfo = Type.Object({
  index: Type.Number(),
  accountName: Type.Optional(Type.String()),
  time: Type.String(),
  type: Type.String(),
  amount: Type.Number(),
  comment: Type.String(),
  tenantName: Type.String(),
  userId: Type.Optional(Type.String()),
  userName: Type.Optional(Type.String()),
  metadata: Type.Optional(MetadataMap),
});
export type ChargeInfo = Static<typeof ChargeInfo>;

export const GetChargesSchema = typeboxRouteSchema({
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

    // 消费类型
    types: Type.Optional(Type.Array(Type.String())),

    accountNames: Type.Optional(Type.Array(Type.String())),

    // 是否为平台管理下的记录：如果是则需查询所有租户，如果不是只查询当前租户
    isPlatformRecords: Type.Optional(Type.Boolean()),

    // 查询消费记录种类：平台账户消费记录或租户消费记录
    searchType: Type.Optional(Type.Enum(SearchType)),

    // 消费的用户id
    userIds: Type.Optional(Type.Array(Type.String())),

    /**
     * @minimum 1
     * @type integer
     */
    page: Type.Optional(Type.Integer({ minimum: 1 })),

    /**
     * @type integer
     */
    pageSize: Type.Optional(Type.Integer()),

    sortBy:Type.Optional(ChargesSortBy),

    sortOrder:Type.Optional(ChargesSortOrder),

    // 消费的用户id或者name
    userIdsOrNames:  Type.Optional(Type.Array(Type.String())),
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(ChargeInfo),
    }),
  },
});

export async function getUserInfoForCharges(accountNames: string [] | undefined, req, res):
Promise<UserInfo | undefined> {
  if (accountNames) {
    return await authenticate((i) =>
      i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
      // 排除掉前面的平台和租户管理员，只剩下账户管理员
      accountNames.length === 1 &&
      i.accountAffiliations.some((x) => x.accountName === accountNames[0] && x.role !== UserRole.USER),
    )(req, res);
  } else {
    return await authenticate((i) =>
      i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    )(req, res);
  }
}

export async function getTenantOfAccount(accountNames: string[] | undefined, info: UserInfo): Promise<string> {

  if (accountNames?.length === 1) {
    const client = getClient(AccountServiceClient);

    const { results } = await asyncClientCall(client, "getAccounts", {
      accountName:accountNames[0],
    });
    if (results.length !== 0) {
      return results[0].tenantName;
    }
  }

  return info.tenant;
}

export const buildChargesRequestTarget = (accountNames: string[] | undefined, tenantName: string,
  searchType: SearchType | undefined, isPlatformRecords: boolean | undefined): (
    { $case: "accountOfTenant"; accountOfTenant: AccountOfTenantTarget }
    | { $case: "accountsOfTenant"; accountsOfTenant: AccountsOfTenantTarget }
    | { $case: "accountsOfAllTenants"; accountsOfAllTenants: AccountsOfAllTenantsTarget }
    | { $case: "tenant"; tenant: TenantTarget }
    | { $case: "allTenants"; allTenants: AllTenantsTarget }
    | undefined
  ) => {
  if (accountNames?.length == 1) {
    return {
      $case: "accountOfTenant" as const,
      accountOfTenant: { accountName:accountNames[0], tenantName },
    };
  }
  if (searchType === SearchType.ACCOUNT) {
    if (isPlatformRecords) {
      return {
        $case: "accountsOfAllTenants" as const,
        accountsOfAllTenants: { accountNames:accountNames?.length ? accountNames : []},
      };
    } else {
      return {
        $case: "accountsOfTenant" as const,
        accountsOfTenant: { tenantName, accountNames: accountNames?.length ? accountNames : []},
      };
    }
  } else {
    if (isPlatformRecords) {
      return {
        $case: "allTenants" as const,
        allTenants: {},
      };
    } else {
      return {
        $case: "tenant" as const,
        tenant: { tenantName },
      };
    }
  }
};

export default route(GetChargesSchema, async (req, res) => {
  const { endTime, startTime, accountNames, isPlatformRecords,
    searchType, types, userIds, page, pageSize, sortBy, sortOrder, userIdsOrNames } = req.query;

  const info = await getUserInfoForCharges(accountNames, req, res);
  if (!info) return;

  const tenantOfAccount = await getTenantOfAccount(accountNames, info);

  const client = getClient(ChargingServiceClient);

  // 默认按照时间的倒序排序
  const mapChargesSortBy = sortBy ? mapChargesSortByType[sortBy] : mapChargesSortByType.time;
  const mapChargesSortOrder = sortOrder ? mapChargesSortOrderType[sortOrder] : mapChargesSortOrderType.descend;

  const reply = ensureNotUndefined(await asyncClientCall(client, "getPaginatedChargeRecords", {
    startTime,
    endTime,
    types:types ?? [],
    userIds: userIds ?? [],
    target: buildChargesRequestTarget(accountNames, tenantOfAccount, searchType, isPlatformRecords),
    page,
    pageSize,
    sortBy:mapChargesSortBy,
    sortOrder:mapChargesSortOrder,
    userIdsOrNames:userIdsOrNames ?? [],
  }), []);

  const respUserIds = Array.from(new Set(reply.results.map((x) => x.userId).filter((x) => !!x) as string[]));

  const userClient = getClient(UserServiceClient);
  const { users } = await asyncClientCall(userClient, "getUsersByIds", {
    userIds: respUserIds,
  });
  const userMap = new Map(users.map((x) => [x.userId, x.userName]));

  const accounts = reply.results.map((x) => {
    // 如果是查询平台账户消费记录或者查询账户下的消费记录时，确保accountName存在
    const obj = (searchType === SearchType.ACCOUNT || accountNames) ?
      ensureNotUndefined(x, ["time", "amount", "accountName"]) : ensureNotUndefined(x, ["time", "amount"]);
    return {
      ...obj,
      amount: moneyToNumber(obj.amount),
      metadata: obj.metadata ?? undefined,
      userName: obj.userId ? (userMap.get(obj.userId) || "") : "",
    } as ChargeInfo;
  });
  return {
    200: {
      results: accounts,
    },
  };
});


