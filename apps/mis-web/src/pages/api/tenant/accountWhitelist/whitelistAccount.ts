import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { asyncClientCall } from "@ddadaal/tsgrpc-client";
import { Status } from "@grpc/grpc-js/build/src/constants";
import { OperationType } from "@scow/lib-operation-log";
import { AccountServiceClient } from "@scow/protos/build/server/account";
import { Type } from "@sinclair/typebox";
import { authenticate } from "src/auth/server";
import { OperationResult } from "src/models/operationLog";
import { TenantRole } from "src/models/User";
import { callLog } from "src/server/operationLog";
import { getClient } from "src/utils/client";
import { route } from "src/utils/route";
import { handlegRPCError, parseIp } from "src/utils/server";

export const WhitelistAccountSchema = typeboxRouteSchema({
  method: "PUT",

  body: Type.Object({
    accountName: Type.String(),
    comment: Type.String(),
    expirationTime: Type.String({ format: "date-time" }),
  }),

  responses: {
    204: Type.Null(),
    404: Type.Null(),
    409: Type.Object({ message: Type.String() }),
  },
});

const auth = authenticate((info) => info.tenantRoles.includes(TenantRole.TENANT_ADMIN));

export default route(WhitelistAccountSchema, async (req, res) => {
  const info = await auth(req, res);
  if (!info) {
    return;
  }

  const { accountName, comment, expirationTime } = req.body;

  const logInfo = {
    operatorUserId: info.identityId,
    operatorIp: parseIp(req) ?? "",
    operationTypeName: OperationType.addAccountToWhitelist,
    operationTypePayload: {
      tenantName: info.tenant,
      accountName,
    },
  };

  const client = getClient(AccountServiceClient);

  return await asyncClientCall(client, "whitelistAccount", {
    tenantName: info.tenant,
    accountName,
    operatorId: info.identityId,
    comment,
    expirationTime,
  })
    .then(async () => {
      await callLog(logInfo, OperationResult.SUCCESS);
      return { 204: null };
    })
    .catch(
      handlegRPCError(
        {
          [Status.NOT_FOUND]: () => ({ 404: null }),
          [Status.FAILED_PRECONDITION]: (e) => ({ 409: { message: e.details } }),
        },
        async () => await callLog(logInfo, OperationResult.FAIL),
      ),
    );
});
