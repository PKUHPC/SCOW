import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { BillServiceClient } from "@scow/protos/build/server/bill";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { BillType } from "src/models/bill";
import { PlatformRole, TenantRole, UserInfo, UserRole } from "src/models/User";
import { Money } from "src/models/UserSchemaModel";
import { SearchType } from "src/pageComponents/common/BillTable";
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

export const BillInfo = Type.Object({
  id: Type.Number(),
  tenantName: Type.String(),
  accountName: Type.String(),
  accountOwnerId: Type.String(),
  accountOwnerName: Type.String(),
  term: Type.Optional(Type.String()),
  amount: Money,
  type: Type.String(),
  details: Type.Optional(MetadataMap),
  createTime: Type.Optional(Type.String()),
  updateTime: Type.Optional(Type.String()),
  ids: Type.Array(Type.Number()),
});

export type BillInfo = Static<typeof BillInfo>;

export const GetBillsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    /**
     * @type integer
     */
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    /**
     * @type integer
     */
    pageSize: Type.Optional(Type.Integer()),
    accountNames: Type.Optional(Type.Array(Type.String())),
    type: Type.Enum(BillType),
    userIdsOrNames: Type.Optional(Type.String()), // 支持多个用户ID或名字，使用逗号分隔
    termStart: Type.Optional(Type.String()), // 账期开始，格式如 "202407"
    termEnd: Type.Optional(Type.String()), // 账期结束，格式如 "202407"
    searchType: Type.Optional(Type.Enum(SearchType)),
  }),

  responses: {
    200: Type.Object({
      bills: Type.Array(BillInfo),
      total: Type.Number(),
    }),
  },
});

export default route(GetBillsSchema, async (req, res) => {

  const { pageSize = 10, page = 1, accountNames, userIdsOrNames, termStart, termEnd, type, searchType } = req.query;

  let user: UserInfo | undefined;
  // check whether the user can access the account
  if (searchType === SearchType.selfAccount) {
    user = await authenticate((i) =>
      accountNames?.length === 1 &&
        i.accountAffiliations.some((x) => x.accountName === accountNames[0] && x.role !== UserRole.USER),
    )(req, res);
  } else if (searchType === SearchType.selfTenant) {
    user = await authenticate((i) =>
      i.tenantRoles.includes(TenantRole.TENANT_FINANCE) ||
        i.tenantRoles.includes(TenantRole.TENANT_ADMIN),
    )(req, res);
  } else {
    user = await authenticate((i) =>
      i.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
        i.platformRoles.includes(PlatformRole.PLATFORM_FINANCE),
    )(req, res);
  }

  if (!user) { return; }

  const client = getClient(BillServiceClient);

  const reply = await asyncClientCall(client, "getBills", {
    pageSize, page, accountNames: accountNames ?? [], userIdsOrNames, termStart, termEnd, type,
    tenantName: searchType === SearchType.selfTenant ? user.tenant : undefined,
  });

  return {
    200: {
      bills: reply.bills.map((i) => ensureNotUndefined(i, ["amount"])),
      total: reply.total,
    },
  };
});
