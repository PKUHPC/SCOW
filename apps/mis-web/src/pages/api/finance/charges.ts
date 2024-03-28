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

import { typeboxRoute, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { moneyToNumber } from "@scow/lib-decimal";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { AccountOfTenantTarget, AccountsOfAllTenantsTarget, AccountsOfTenantTarget, AccountsTarget, AllTenantsTarget,
  ChargingServiceClient, TenantTarget } from "@scow/protos/build/server/charging";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole, SearchType, TenantRole, UserInfo, UserRole } from "src/models/User";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";

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
    type: Type.Optional(Type.Array(Type.String())),

    accountName: Type.Optional(Type.Array(Type.String())),

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
  }),

  responses: {
    200: Type.Object({
      results: Type.Array(ChargeInfo),
    }),
  },
});

export async function getUserInfoForCharges(accountName: string [] | undefined, req, res):
Promise<UserInfo | undefined> {
  if (accountName) {
    return await authenticate((i) =>
      i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
      i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
      i.tenantRoles.includes(TenantRole.TENANT_ADMIN) ||
      // 排除掉前面的平台和租户管理员，只剩下账户管理员
      accountName.length === 1 &&
      i.accountAffiliations.some((x) => x.accountName === accountName[0] && x.role !== UserRole.USER),
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

export async function getTenantOfAccount(accountName: string[] | undefined, info: UserInfo): Promise<string> {

  if (accountName?.length === 1) {
    const client = getClient(AccountServiceClient);

    const { results } = await asyncClientCall(client, "getAccounts", {
      accountName:accountName[0],
    });
    if (results.length !== 0) {
      return results[0].tenantName;
    }
  }

  return info.tenant;
}

export const buildChargesRequestTarget = (accountName: string[] | undefined, tenantName: string,
  searchType: SearchType | undefined, isPlatformRecords: boolean | undefined): (
    { $case: "accounts"; accounts: AccountsTarget }
    | { $case: "accountOfTenant"; accountOfTenant: AccountOfTenantTarget }
    | { $case: "accountsOfTenant"; accountsOfTenant: AccountsOfTenantTarget }
    | { $case: "accountsOfAllTenants"; accountsOfAllTenants: AccountsOfAllTenantsTarget }
    | { $case: "tenant"; tenant: TenantTarget }
    | { $case: "allTenants"; allTenants: AllTenantsTarget }
    | undefined
  ) => {
  if (accountName) {
    // 多个账户名
    if (accountName.length !== 1) {
      return {
        $case: "accounts" as const,
        accounts: { accounts:accountName },
      };
    }

    return {
      $case: "accountOfTenant" as const,
      accountOfTenant: { accountName:accountName[0], tenantName },
    };
  } else {
    if (searchType === SearchType.ACCOUNT) {
      if (isPlatformRecords) {
        return {
          $case: "accountsOfAllTenants" as const,
          accountsOfAllTenants: {},
        };
      } else {
        return {
          $case: "accountsOfTenant" as const,
          accountsOfTenant: { tenantName },
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
  }
};

export default typeboxRoute(GetChargesSchema, async (req, res) => {
  const { endTime, startTime, accountName, isPlatformRecords,
    searchType, type, userIds, page, pageSize } = req.query;

  const info = await getUserInfoForCharges(accountName, req, res);
  if (!info) return;

  const tenantOfAccount = await getTenantOfAccount(accountName, info);

  const client = getClient(ChargingServiceClient);

  const reply = ensureNotUndefined(await asyncClientCall(client, "getPaginatedChargeRecords", {
    startTime,
    endTime,
    type:type ?? [],
    userIds: userIds ?? [],
    target: buildChargesRequestTarget(accountName, tenantOfAccount, searchType, isPlatformRecords),
    page,
    pageSize,
  }), []);

  const respUserIds = Array.from(new Set(reply.results.map((x) => x.userId).filter((x) => !!x) as string[]));

  const userClient = getClient(UserServiceClient);
  const { users } = await asyncClientCall(userClient, "getUsersByIds", {
    userIds: respUserIds,
  });
  const userMap = new Map(users.map((x) => [x.userId, x.userName]));

  const accounts = reply.results.map((x) => {
    // 如果是查询平台账户消费记录或者查询账户下的消费记录时，确保accountName存在
    const obj = (searchType === SearchType.ACCOUNT || accountName) ?
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


