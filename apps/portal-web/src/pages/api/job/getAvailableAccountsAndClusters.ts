import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { ConfigServiceClient } from "@scow/protos/build/portal/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const AvailableAccountsAndClustersItem = Type.Object({
  accountName: Type.String(),
  clusters: Type.Array(Type.String()),
});

export const AvailableAccountsAndClusters = Type.Array(AvailableAccountsAndClustersItem);

export type AvailableAccountsAndClusters = Static<typeof AvailableAccountsAndClusters>;

export const GetAvailableAccountsAndClustersSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({}),

  responses: {
    200: Type.Object({
      accountClusters: AvailableAccountsAndClusters,
    }),
  },
});

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(GetAvailableAccountsAndClustersSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const client = getClient(ConfigServiceClient);

  const reply = await asyncUnaryCall(client, "getAvailableAccountsAndClusters", {
    userId: info.identityId,
  });
  return { 200: { accountClusters: reply.accountClusters ?? [] } };
});
