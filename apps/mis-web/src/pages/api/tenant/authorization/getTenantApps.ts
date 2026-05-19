import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { AppAuthorizationServiceClient } from "@scow/protos/build/server/app_authorization";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { TenantRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const TenantAppInfo = Type.Object({
  id: Type.String(),
  name: Type.String(),
  logoPath: Type.Optional(Type.String()),
  isDefault: Type.Boolean(),
});
export type TenantAppInfo = Static<typeof TenantAppInfo>;

export const GetTenantAppsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    clusterId: Type.String(),
  }),

  responses: {
    200: Type.Object({
      tenantApps: Type.Array(TenantAppInfo),
    }),
    409: Type.Object({
      code: Type.Literal("FAILED_PRECONDITION"),
      message: Type.Optional(Type.String()),
    }),
  },
});

export default route(GetTenantAppsSchema, async (req, res) => {
  const { clusterId } = req.query;

  const auth = authenticate((info) => {
    return info.tenantRoles.includes(TenantRole.TENANT_ADMIN);
  });

  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const client = getClient(AppAuthorizationServiceClient);

  return await asyncUnaryCall(client, "getTenantApps", {
    clusterId,
    tenantName: info.tenant,
  })
    .then((reply) => ({
      200: {
        tenantApps: reply.tenantApps,
      },
    }))
    .catch(
      handlegRPCError({
        [Status.FAILED_PRECONDITION]: (e) => ({
          409: {
            code: "FAILED_PRECONDITION" as const,
            message: e.message,
          },
        }),
      }),
    );
});
