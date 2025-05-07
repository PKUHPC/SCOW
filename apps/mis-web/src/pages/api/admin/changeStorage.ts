import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AdminServiceClient, ChangeStorageQuotaMode } from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const ChangeStorageMode = Type.Union([
  Type.Literal("INCREASE"),
  Type.Literal("DECREASE"),
  Type.Literal("SET"),
]);
export type ChangeStorageMode = Static<typeof ChangeStorageMode>;

export const ChangeStorageQuotaSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    cluster: Type.String(),
    userId: Type.String(),

    mode: ChangeStorageMode,

    /**
     * @minimum 0
     * @type integer
     */
    value: Type.Integer({ minimum: 0 }),

  }),

  responses: {
    200: Type.Object({
      currentQuota: Type.Number(),
    }),

    400: Type.Object({
      code: Type.Literal("DELTA_NOT_VALID"),
    }),

    404: Type.Null(),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(ChangeStorageQuotaSchema,
  async (req, res) => {

    const info = await auth(req, res);
    if (!info) {
      return;
    }

    const { mode, value, userId, cluster } = req.body;

    const client = getClient(AdminServiceClient);

    return await asyncClientCall(client, "changeStorageQuota", {
      mode: ChangeStorageQuotaMode[mode],
      value,
      cluster,
      userId,
    })
      .then(({ currentQuota }) => ({ 200: { currentQuota } }))
      .catch(handlegRPCError({
        [Status.INVALID_ARGUMENT]: () => ({ 400: { code: "DELTA_NOT_VALID" as const } }),
        [Status.NOT_FOUND]: () => ({ 404: null }),
      }));
  });
