import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Static, Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { AccountStatus } from "src/models/UserSchemaModel";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";

// Cannot use GetUserStatusResponse from protos
export const GetUserStatusResponse = Type.Object({
  /** account and its status */
  accountStatuses: Type.Record(Type.String(), AccountStatus),
  /** cluster and quota */
  storageQuotas: Type.Record(Type.String(), Type.Number()),
});
export type GetUserStatusResponse = Static<typeof GetUserStatusResponse>;

export const GetUserStatusSchema = typeboxRouteSchema({

  method: "GET",

  responses: {
    200: GetUserStatusResponse,
  },
});

export const getUserStatus = async (userId: string, tenant: string) => {

  const client = getClient(UserServiceClient);

  return await asyncClientCall(client, "getUserStatus", {
    tenantName: tenant,
    userId,
  });
};

export default route(GetUserStatusSchema, async (req, res) => {
  const auth = authenticate((i) => i.accountAffiliations.length > 0);

  const info = await auth(req, res);

  if (!info) { return; }

  const result = await getUserStatus(info.identityId, info.tenant);

  return {
    200: result,
  };
});
