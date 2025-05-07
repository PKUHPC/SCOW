import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { AccountServiceClient, GetAccountsRequest } from "@scow/protos/build/server/account";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AccountState, DisplayedAccountState, PlatformRole } from "src/models/User";
import { Money } from "src/models/UserSchemaModel";
import { ensureNotUndefined } from "src/utils/checkNull";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const AdminAccountInfo = Type.Object({
  tenantName: Type.String(),
  accountName: Type.String(),
  userCount: Type.Number(),
  blocked: Type.Boolean(),
  state: Type.Optional(Type.Enum(AccountState)),
  displayedState: Type.Optional(Type.Enum(DisplayedAccountState)),
  isInWhitelist: Type.Optional(Type.Boolean()),
  ownerId: Type.String(),
  ownerName: Type.String(),
  comment: Type.String(),
  balance: Money,
  blockThresholdAmount: Type.Optional(Money),
  defaultBlockThresholdAmount: Money,
});
export type AdminAccountInfo = Static<typeof AdminAccountInfo>;

export const GetAllAccountsSchema = typeboxRouteSchema({
  method: "GET",
  responses: {
    200: Type.Object({
      results: Type.Array(AdminAccountInfo),
    }),
  },
});

export async function getAllAccounts(req: GetAccountsRequest) {
  const uaClient = getClient(AccountServiceClient);

  const { results } = await asyncClientCall(uaClient, "getAccounts", req);

  return results.map((x) => ensureNotUndefined(x, ["balance", "defaultBlockThresholdAmount"]));
}

const auth = authenticate((info) =>
  info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN) ||
  info.platformRoles.includes(PlatformRole.PLATFORM_FINANCE));

export default route(GetAllAccountsSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }
    const results = await getAllAccounts({});

    return { 200: { results } };
  });
