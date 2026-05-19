import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncUnaryCall } from "@ddadaal/tsgrpc-client";
import { status } from "@grpc/grpc-js";
import { AdminServiceClient } from "@scow/protos/build/server/admin";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { ClusterAccountInfo } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { queryIfInitialized } from "src/utils/init";
import { route } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

// Cannot use GetClusterUsersResponse from protos
export const GetClusterUsersResponse = Type.Object({
  accounts: Type.Array(ClusterAccountInfo),
});
export type GetClusterUsersResponse = Static<typeof GetClusterUsersResponse>;

export const GetClusterUsersSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    cluster: Type.String(),
  }),

  responses: {
    200: GetClusterUsersResponse,

    409: Type.Object({
      code: Type.Union([Type.Literal("FAILED_PRECONDITION"), Type.Literal("UNIMPLEMENTED")]),
      message: Type.String(),
    }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default /* #__PURE__*/ route(GetClusterUsersSchema, async (req, res) => {
  // if not initialized, every one can import users
  if (await queryIfInitialized()) {
    const info = await auth(req, res);
    if (!info) {
      return;
    }
  }
  const { cluster } = req.query;

  const client = getClient(AdminServiceClient);

  return await asyncUnaryCall(client, "getClusterUsers", {
    cluster,
  })
    .then((result) => ({ 200: result }))
    .catch(
      handlegRPCError({
        [status.FAILED_PRECONDITION]: () => ({
          409: {
            code: "FAILED_PRECONDITION" as const,
            message:
              "The method is not supported with your current scheduler adapter version, " +
              "please confirm the adapter version detail",
          },
        }),
        [status.UNIMPLEMENTED]: () => ({
          409: {
            code: "UNIMPLEMENTED" as const,
            message: "The scheduler API version can not be confirmed.",
          },
        }),
      }),
    );
});
