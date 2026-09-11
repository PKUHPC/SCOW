import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { StorageServiceClient } from "@scow/protos/build/server/storage";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { PlatformRole } from "src/models/User";
import { getClient } from "src/utils/client";
import { route, ScowErrorResponse } from "src/utils/route";
import { handlegRPCError } from "src/utils/server";

export const EnableAccountStorageQuotaSchema = typeboxRouteSchema({
  method: "POST",
  responses: {
    200: Type.Object({}),
    500: ScowErrorResponse,
    409: Type.Object({
      code: Type.Union([
        Type.Literal("USER_GROUP_NOT_ENABLED"),
        Type.Literal("ALREADY_ENABLED_OR_ENABLING"),
        Type.Literal("MULTI_ACCOUNT_USERS"),
        Type.Literal("MULTI_GROUP_USERS"),
        Type.Literal("DEFAULT_GROUP_NOT_REMOVED"),
      ]),
      users: Type.Optional(Type.String()),
    }),
  },
});

const auth = authenticate((info) => info.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

export default route(EnableAccountStorageQuotaSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) { return; }

  const client = getClient(StorageServiceClient);

  return await asyncClientCall(client, "enableAccountStorageQuota", { operatorId: info.identityId })
    .then(() => ({ 200: {} }))
    .catch(handlegRPCError({
      [Status.FAILED_PRECONDITION]: (e) => {
        if (e.metadata.get("SCOW_ERROR_CODE")?.length) {
          throw e;
        }
        if (e.details === "USER_GROUP_NOT_ENABLED") {
          return { 409: { code: "USER_GROUP_NOT_ENABLED" as const } };
        } else if (e.details === "ALREADY_ENABLED_OR_ENABLING") {
          return { 409: { code: "ALREADY_ENABLED_OR_ENABLING" as const } };
        } else if (e.details?.startsWith("MULTI_ACCOUNT_USERS:")) {
          return { 409: { code: "MULTI_ACCOUNT_USERS" as const, users: e.details.slice("MULTI_ACCOUNT_USERS:".length) } };
        } else if (e.details?.startsWith("MULTI_GROUP_USERS:")) {
          return { 409: { code: "MULTI_GROUP_USERS" as const, users: e.details.slice("MULTI_GROUP_USERS:".length) } };
        } else if (e.details?.startsWith("DEFAULT_GROUP_NOT_REMOVED:")) {
          return { 409: { code: "DEFAULT_GROUP_NOT_REMOVED" as const, users: e.details.slice("DEFAULT_GROUP_NOT_REMOVED:".length) } };
        } else {
          return { 409: { code: "ALREADY_ENABLED_OR_ENABLING" as const } };
        }
      },
    }));
});
