import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { AccountUnavailableReason, ConfigServiceClient } from "@scow/protos/build/portal/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const AvailableAccountsAndClustersItem = Type.Object({
  accountName: Type.String(),
  clusters: Type.Array(Type.String()),
  available: Type.Boolean(),
  unavailableReasons: Type.Array(Type.Enum(AccountUnavailableReason)),
});

export const AvailableAccountsAndClusters = Type.Array(AvailableAccountsAndClustersItem);

export type AvailableAccountsAndClusters = Static<typeof AvailableAccountsAndClusters>;

export const GetAccountClustersWithUnavailableReasonsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({}),

  responses: {
    200: Type.Object({
      accountClusters: AvailableAccountsAndClusters,
    }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(GetAccountClustersWithUnavailableReasonsSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(ConfigServiceClient);

  const reply = await asyncUnaryCall(client, "getAccountClustersWithUnavailableReasons", {
    userId: info.identityId,
  });
  return { 200: { accountClusters: reply.accountClusters ?? [] } };
});
