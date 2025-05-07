import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { UserServiceClient } from "@scow/protos/build/server/user";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { PlatformRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const ChangeTenantSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    identityId: Type.String(),
    previousTenantName: Type.String(),
    tenantName: Type.String(),
  }),

  responses: {
    204: Type.Null(),

    404: Type.Object({
      code: Type.Union([
        Type.Literal("USER_NOT_FOUND"),
        Type.Literal("TENANT_NOT_FOUND"),
      ]),
    }),

    409: Type.Object({
      code: Type.Literal("USER_ALREADY_EXIST_IN_THIS_TENANT"),
    }),

    422: Type.Object({
      code: Type.Union([
        Type.Literal("USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP"),
        Type.Literal("USER_STILL_MAINTAINS_TENANT_ROLES"),
      ]),
    }),
  },
});

export default /* #__PURE__*/route(ChangeTenantSchema, async (req, res) => {
  const { identityId, tenantName, previousTenantName } = req.body;

  const auth = authenticate((u) => u.platformRoles.includes(PlatformRole.PLATFORM_ADMIN));

  const info = await auth(req, res);

  if (!info) { return; }

  const client = getClient(UserServiceClient);

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.userChangeTenant,
    operationTypePayload:{
      userId: identityId,
      previousTenantName,
      newTenantName: tenantName,
    },
  };

  return await asyncClientCall(client, "changeTenant", {
    userId: identityId,
    tenantName,
  }).then(async () => {
    await callLog(logInfo, OperationResult.SUCCESS);
    return { 204: null };
  })
    .catch(handlegRPCError({
      [Status.ALREADY_EXISTS]: () => ({ 409: { code: "USER_ALREADY_EXIST_IN_THIS_TENANT" as const } }),
      [Status.FAILED_PRECONDITION]: (e) => {
        return {
          422: e.details === "USER_STILL_MAINTAINS_TENANT_ROLES"
            ? { code: "USER_STILL_MAINTAINS_TENANT_ROLES" as const }
            : { code: "USER_STILL_MAINTAINS_ACCOUNT_RELATIONSHIP" as const },
        };
      },
      [Status.NOT_FOUND]: (e) => {
        if (e.details === "USER_NOT_FOUND") {
          return { 404: { code: "USER_NOT_FOUND" as const } };
        } else {
          return { 404: { code: "TENANT_NOT_FOUND" as const } };
        }
      },
    },
    async () => await callLog(logInfo, OperationResult.FAIL),
    ));
});
