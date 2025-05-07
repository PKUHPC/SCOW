import { Type, typeboxRouteSchema } from "@ddadaal/next-typed-api-routes-runtime";
import { OperationType } from "@scow/lib-operation-log";
import { redirectToAuthLogin } from "@scow/lib-web/build/routes/auth/redirectToLogin";
import { setTokenCookie } from "src/auth/cookie";
import { validateToken } from "src/auth/token";
import { OperationResult } from "src/models/operationLog";
import { callLog } from "src/server/operationLog";
import { publicConfig, runtimeConfig } from "src/utils/config";
import { route } from "src/utils/route";
import { parseIp } from "src/utils/server";

export const AuthCallbackSchema = typeboxRouteSchema({
  method: "GET",

  query: Type.Object({
    token: Type.String(),
    fromAuth: Type.Optional(Type.Boolean()),
  }),

  responses: {
    200: Type.Null(),
    /** the token is invalid */
    403: Type.Null(),
  },
});


export default route(AuthCallbackSchema, async (req, res) => {

  const { token, fromAuth = false } = req.query;

  const info = await validateToken(token);

  if (info) {
    // set token cache
    setTokenCookie({ res }, token);
    if (fromAuth) {
      const logInfo = {
        operatorUserId: info.identityId,
        operatorIp: parseIp(req) ?? "",
        operationTypeName: OperationType.login,
      };
      await callLog(logInfo, OperationResult.SUCCESS);
    }
    res.redirect(publicConfig.BASE_PATH);
  } else {
    redirectToAuthLogin(req, res, runtimeConfig.PROTOCOL, publicConfig.BASE_PATH, runtimeConfig.AUTH_EXTERNAL_URL);
  }

});
