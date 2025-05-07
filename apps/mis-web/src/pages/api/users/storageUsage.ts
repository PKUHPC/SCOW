import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

export const QueryStorageUsageSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      result: Type.Number(),
    }),

    404: Type.Null(),
  },
});

export default route(QueryStorageUsageSchema, async (req, res) => {

  const auth = authenticate(() => true);

  const info = await auth(req, res);

  if (!info) { return; }

  const { cluster } = req.query;

  const client = getClient(UserServiceClient);

  const reply = await asyncClientCall(client, "queryUsedStorageQuota", {
    tenantName: info.tenant,
    userId: info.identityId,
    cluster: cluster,
  });

  return {
    200: {
      result: reply.used,
    },
  };

});
