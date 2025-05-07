import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const QueryStorageQuotaSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
    userId: Type.String(),
  }),

  responses: {
    200: Type.Object({
      currentQuota: Type.Number(),
    }),

    404: Type.Null(),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(QueryStorageQuotaSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) { return; }

    const { userId, cluster } = req.query;

    const client = getClient(AdminServiceClient);

    return await asyncClientCall(client, "queryStorageQuota", {
      cluster,
      userId,
    })
      .then(({ currentQuota }) => ({ 200: { currentQuota } }))
      .catch(handlegRPCError({
        [Status.NOT_FOUND]: () => ({ 404: null }),
      }));
  });
