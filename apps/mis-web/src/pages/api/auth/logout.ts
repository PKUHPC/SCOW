import { typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { deleteToken } from "@scow/lib-auth";
import { OperationType } from "@scow/lib-operation-log";
import { Type } from "@sinclair/typebox";
import { getTokenFromCookie } from "src/auth/cookie";
import { validateToken } from "src/auth/token";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const LogoutSchema = typeboxRouteSchema({
  method: "DELETE",

  responses: {
    204: Type.Null(),
  },
});


export default route(LogoutSchema, async (req) => {

  const token = getTokenFromCookie({ req });

  if (token) {
    const info = await validateToken(token);
    if (info) {
      const logInfo = {
        operatorUserId: info.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.logout,
      };
      await callLog(logInfo, OperationResult.SUCCESS);
    }
    await deleteToken(token, runtimeConfig.AUTH_INTERNAL_URL);
  }
  return { 204: null };

});
