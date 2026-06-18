import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AppServiceClient } from "@scow/protos/build/portal/app";
import { AccountUnavailableReason } from "@scow/protos/build/portal/config";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const AccountAvailability = Type.Object({
  accountName: Type.String(),
  available: Type.Boolean(),
  unavailableReasons: Type.Array(Type.Enum(AccountUnavailableReason)),
});
export type AccountAvailability = Static<typeof AccountAvailability>;

// Cannot use App from protos
export const App = Type.Object({
  id: Type.String(),
  name: Type.String(),
  logoPath: Type.Optional(Type.String()),
  availableAccounts: Type.Array(Type.String()),
  accountAvailabilities: Type.Array(AccountAvailability),
});
export type App = Static<typeof App>;

export const ListAvailableAppsSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
  }),

  responses: {
    200: Type.Object({
      // 公共配置config/apps
      // 与集群配置下config/clusters/[clusterId]/apps下的应用
      // 如果app.id重复，则按照集群配置下读取
      apps: Type.Array(App),
    }),

    403: Type.Null(),

    500: Type.Object({
      code: Type.Literal("APP_CONFIG_ERROR"),
      error: Type.String(),
    }),
  },
});

// ~~ DEPRECATED: Old implementation, replaced with new version ~~
// ~~ This API is called from server ~~
// ~~ API call from server doesn't contain any cookie ~~
// ~~ So the API cannot use authenticate way ~~
//
// ~~ it's limitation from next-typed-api-routes ~~
// ~~ Will be resolved after migrating to trpc ~~
//
// ~~ For now, the API requires token from query ~~
// ~~ and authenticate manually ~~

const auth = authenticate(() => true);

export default /* #__PURE__*/ route(ListAvailableAppsSchema, async (req, res) => {
  const info = await auth(req, res);

  if (!info) {
    return;
  }

  const { cluster } = req.query;

  const client = getClient(AppServiceClient);

  return asyncUnaryCall(client, "listAvailableApps", { cluster, userId: info.identityId }).then(
    (reply) => {
      return { 200: { apps: reply.apps } };
    },
    handlegRPCError({
      [status.UNKNOWN]: (e) => ({ 500: { code: "APP_CONFIG_ERROR" as const, error: e.details } }),
    }),
  );
});
